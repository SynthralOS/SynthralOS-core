import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Storage Service
 * 
 * Handles file storage operations using Supabase Storage
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase URL and Service Key must be configured for storage operations');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

export class StorageService {
  private readonly BUCKET_NAME = 'code-agents';
  private bucketInitialized = false;

  /**
   * Initialize bucket (create if it doesn't exist)
   * This should be called on startup or before first use
   */
  async initializeBucket(): Promise<void> {
    if (this.bucketInitialized) {
      return;
    }

    try {
      const client = getSupabaseClient();
      
      // Check if bucket exists
      const { data: buckets, error: listError } = await client.storage.listBuckets();
      
      if (listError) {
        console.warn('Failed to list Supabase Storage buckets:', listError.message);
        return;
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);

      if (!bucketExists) {
        // Create bucket if it doesn't exist
        const { error: createError } = await client.storage.createBucket(this.BUCKET_NAME, {
          public: false, // Private bucket
          fileSizeLimit: 10485760, // 10MB limit per file
          allowedMimeTypes: ['text/plain', 'text/x-python', 'application/javascript', 'application/typescript'],
        });

        if (createError) {
          // RLS policy errors are expected - bucket needs to be created manually or RLS policies configured
          if (createError.message?.includes('row-level security') || createError.message?.includes('RLS')) {
            // Silently skip - this is expected if RLS is enabled
            return;
          }
          console.warn(`Failed to create Supabase Storage bucket '${this.BUCKET_NAME}':`, createError.message);
          console.warn('Bucket may need to be created manually in Supabase dashboard or RLS policies configured');
          return;
        }

        console.log(`✅ Supabase Storage bucket '${this.BUCKET_NAME}' created successfully`);
      }

      this.bucketInitialized = true;
    } catch (error: any) {
      // If storage is not configured, silently fail
      if (error.message?.includes('must be configured')) {
        console.warn('Supabase Storage not configured, skipping bucket initialization');
        return;
      }
      console.warn('Error initializing Supabase Storage bucket:', error.message);
    }
  }

  /**
   * Upload code blob to Supabase Storage
   * Returns the storage path
   */
  async uploadCodeBlob(
    code: string,
    agentId: string,
    version: string
  ): Promise<string> {
    try {
      // Ensure bucket is initialized
      await this.initializeBucket();

      const client = getSupabaseClient();
      const fileName = `${agentId}/${version}.txt`;
      const filePath = `code-blobs/${fileName}`;

      // Upload file
      const { data, error } = await client.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, code, {
          contentType: 'text/plain',
          upsert: true,
        });

      if (error) {
        // If bucket doesn't exist, try to create it and retry
        if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
          await this.initializeBucket();
          const { data: retryData, error: retryError } = await client.storage
            .from(this.BUCKET_NAME)
            .upload(filePath, code, {
              contentType: 'text/plain',
              upsert: true,
            });

          if (retryError) {
            throw new Error(`Failed to upload code blob: ${retryError.message}`);
          }

          return filePath;
        }

        throw new Error(`Failed to upload code blob: ${error.message}`);
      }

      return filePath;
    } catch (error: any) {
      // If storage is not configured, return empty string (code will be stored in DB)
      if (error.message?.includes('must be configured')) {
        console.warn('Supabase Storage not configured, storing code in database');
        return '';
      }
      throw error;
    }
  }

  /**
   * Download code blob from Supabase Storage
   */
  async downloadCodeBlob(storagePath: string): Promise<string | null> {
    try {
      if (!storagePath) {
        return null;
      }

      const client = getSupabaseClient();
      const { data, error } = await client.storage
        .from(this.BUCKET_NAME)
        .download(storagePath);

      if (error) {
        console.error('Failed to download code blob:', error);
        return null;
      }

      return await data.text();
    } catch (error: any) {
      console.error('Error downloading code blob:', error);
      return null;
    }
  }

  /**
   * Delete code blob from Supabase Storage
   */
  async deleteCodeBlob(storagePath: string): Promise<void> {
    try {
      if (!storagePath) {
        return;
      }

      const client = getSupabaseClient();
      const { error } = await client.storage
        .from(this.BUCKET_NAME)
        .remove([storagePath]);

      if (error) {
        console.error('Failed to delete code blob:', error);
      }
    } catch (error: any) {
      console.error('Error deleting code blob:', error);
    }
  }

  /**
   * Check if code should be stored in storage (if > 100KB)
   */
  shouldStoreInStorage(code: string): boolean {
    const sizeInBytes = Buffer.byteLength(code, 'utf8');
    const sizeInKB = sizeInBytes / 1024;
    return sizeInKB > 100; // Store in storage if > 100KB
  }
}

export const storageService = new StorageService();

