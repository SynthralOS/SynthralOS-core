import { db } from '../config/database';
import { invitations, users, organizationMembers, teams, teamMembers } from '../../drizzle/schema';
import { eq, and, or } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export interface InvitationConfig {
  organizationId: string;
  email: string;
  workspaceId?: string;
  teamId?: string;
  roleId?: string;
  invitedBy: string;
  expiresInDays?: number;
}

export class InvitationService {
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Generate a secure invitation token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create and send an invitation
   */
  async createInvitation(config: InvitationConfig): Promise<typeof invitations.$inferSelect> {
    // Check if user is already a member
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, config.email))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, existingUser.id),
            eq(organizationMembers.organizationId, config.organizationId)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new Error('User is already a member of this organization');
      }
    }

    // Check for existing pending invitation
    const [existingInvitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, config.email),
          eq(invitations.organizationId, config.organizationId),
          eq(invitations.acceptedAt, null as any)
        )
      )
      .limit(1);

    if (existingInvitation && new Date(existingInvitation.expiresAt) > new Date()) {
      throw new Error('An active invitation already exists for this email');
    }

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (config.expiresInDays || 7));

    const [newInvitation] = await db
      .insert(invitations)
      .values({
        id: createId(),
        organizationId: config.organizationId,
        workspaceId: config.workspaceId,
        teamId: config.teamId,
        email: config.email,
        roleId: config.roleId,
        invitedBy: config.invitedBy,
        token,
        expiresAt,
      })
      .returning();

    // Send invitation email
    await this.sendInvitationEmail(newInvitation);

    return newInvitation;
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(invitation: typeof invitations.$inferSelect): Promise<void> {
    if (!this.emailTransporter) {
      console.warn('SMTP not configured, skipping email send');
      return;
    }

    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitations/accept?token=${invitation.token}`;

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@sos-platform.com',
        to: invitation.email,
        subject: 'Invitation to join SynthralOS Automation Platform',
        html: `
          <h2>You've been invited!</h2>
          <p>You have been invited to join an organization on the SynthralOS Automation Platform.</p>
          <p><a href="${acceptUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
          <p>This invitation will expire on ${new Date(invitation.expiresAt).toLocaleDateString()}.</p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${acceptUrl}</p>
        `,
      });
    } catch (error) {
      console.error('Error sending invitation email:', error);
      // Don't throw - invitation is still created
    }
  }

  /**
   * Get all invitations for an organization
   */
  async getInvitations(organizationId: string): Promise<(typeof invitations.$inferSelect & { inviter: typeof users.$inferSelect })[]> {
    const orgInvitations = await db
      .select({
        id: invitations.id,
        organizationId: invitations.organizationId,
        workspaceId: invitations.workspaceId,
        teamId: invitations.teamId,
        email: invitations.email,
        roleId: invitations.roleId,
        invitedBy: invitations.invitedBy,
        token: invitations.token,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        createdAt: invitations.createdAt,
        inviter: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(invitations)
      .innerJoin(users, eq(invitations.invitedBy, users.id))
      .where(eq(invitations.organizationId, organizationId))
      .orderBy(invitations.createdAt);

    return orgInvitations as any;
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<typeof invitations.$inferSelect | undefined> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invitation) return undefined;

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return undefined;
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return undefined;
    }

    return invitation;
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Check if user email matches invitation email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.email !== invitation.email) {
      throw new Error('Invitation email does not match user email');
    }

    // Add user to organization
    const [existingMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, invitation.organizationId)
        )
      )
      .limit(1);

    if (!existingMember) {
      await db.insert(organizationMembers).values({
        id: createId(),
        userId,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId,
        role: 'member' as any, // Default role
      });
    }

    // Add to team if specified
    if (invitation.teamId) {
      const [existingTeamMember] = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, invitation.teamId),
            eq(teamMembers.userId, userId)
          )
        )
        .limit(1);

      if (!existingTeamMember) {
        await db.insert(teamMembers).values({
          id: createId(),
          teamId: invitation.teamId,
          userId,
          roleId: invitation.roleId,
        });
      }
    }

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, invitationId));
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(invitationId: string): Promise<void> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.acceptedAt) {
      throw new Error('Invitation has already been accepted');
    }

    await this.sendInvitationEmail(invitation);
  }
}

export const invitationService = new InvitationService();

