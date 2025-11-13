/**
 * Integration tests for EmailTriggerMonitoring
 * These tests require a running database connection
 * Run with: npm test -- emailTriggerMonitoring.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { emailTriggerMonitoring } from '../emailTriggerMonitoring';

describe('EmailTriggerMonitoring Integration Tests', () => {
  beforeAll(() => {
    // Setup: Ensure test environment
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Integration tests should run in test environment');
    }
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Database Integration', () => {
    it('should update metrics from database', async () => {
      // This test requires actual database connection
      // In a real scenario, you'd use a test database
      await expect(
        emailTriggerMonitoring.updateMetricsFromDatabase()
      ).resolves.not.toThrow();
    });

    it('should initialize health record from database', async () => {
      // This would require a test trigger in the database
      const testTriggerId = 'test-trigger-integration-1';
      await expect(
        emailTriggerMonitoring.initializeHealthRecord(testTriggerId)
      ).resolves.not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect metrics without errors', () => {
      const metrics = emailTriggerMonitoring.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalTriggers).toBe('number');
      expect(typeof metrics.activeTriggers).toBe('number');
    });
  });
});

