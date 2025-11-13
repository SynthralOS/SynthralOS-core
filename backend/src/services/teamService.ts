import { db } from '../config/database';
import { teams, teamMembers, users, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export interface TeamConfig {
  organizationId: string;
  name: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(config: TeamConfig): Promise<typeof teams.$inferSelect> {
    const [newTeam] = await db
      .insert(teams)
      .values({
        id: createId(),
        organizationId: config.organizationId,
        name: config.name,
        description: config.description,
        settings: config.settings as any,
      })
      .returning();

    return newTeam;
  }

  /**
   * Get all teams for an organization
   */
  async getTeams(organizationId: string): Promise<(typeof teams.$inferSelect & { memberCount: number })[]> {
    const orgTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, organizationId));

    // Get member count for each team
    const teamsWithCounts = await Promise.all(
      orgTeams.map(async (team) => {
        const members = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));

        return {
          ...team,
          memberCount: members.length,
        };
      })
    );

    return teamsWithCounts;
  }

  /**
   * Get a single team by ID
   */
  async getTeam(teamId: string): Promise<(typeof teams.$inferSelect & { members: (typeof teamMembers.$inferSelect & { user: typeof users.$inferSelect })[] }) | undefined> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return undefined;

    // Get team members with user details
    const members = await db
      .select({
        id: teamMembers.id,
        teamId: teamMembers.teamId,
        userId: teamMembers.userId,
        roleId: teamMembers.roleId,
        joinedAt: teamMembers.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId));

    return {
      ...team,
      members: members as any,
    };
  }

  /**
   * Update a team
   */
  async updateTeam(
    teamId: string,
    updates: {
      name?: string;
      description?: string;
      settings?: Record<string, unknown>;
    }
  ): Promise<typeof teams.$inferSelect | undefined> {
    const updateData: Partial<typeof teams.$inferInsert> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.settings !== undefined) updateData.settings = updates.settings as any;
    updateData.updatedAt = new Date();

    const [updatedTeam] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, teamId))
      .returning();

    return updatedTeam;
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: string): Promise<boolean> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return false;

    await db.delete(teams).where(eq(teams.id, teamId));
    return true;
  }

  /**
   * Add member to team
   */
  async addMember(teamId: string, userId: string, roleId?: string): Promise<typeof teamMembers.$inferSelect> {
    // Check if user is already a member
    const [existing] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      throw new Error('User is already a member of this team');
    }

    const [newMember] = await db
      .insert(teamMembers)
      .values({
        id: createId(),
        teamId,
        userId,
        roleId,
      })
      .returning();

    return newMember;
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      );
  }

  /**
   * Update team member role
   */
  async updateMemberRole(teamId: string, userId: string, roleId: string | null): Promise<void> {
    await db
      .update(teamMembers)
      .set({ roleId })
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId)
        )
      );
  }
}

export const teamService = new TeamService();

