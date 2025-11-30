/**
 * @file test-promotion-rules.ts
 * @description Test script to verify promotionRules handling in API endpoints
 * Tests Task 6.2 implementation from ADR-007
 */

import { PrismaClient } from '@prisma/client';
import jsonLogic from 'json-logic-js';

const prisma = new PrismaClient();

async function testPromotionRules() {
  console.log('Testing promotionRules functionality for API endpoints...\n');

  try {
    // Find an existing endpoint to test with
    const existingEndpoint = await prisma.api_endpoints.findFirst({
      where: { isActive: true }
    });

    if (!existingEndpoint) {
      console.log('❌ No existing endpoints found. Cannot run test.');
      return;
    }

    console.log('Found existing endpoint:', existingEndpoint.name);
    console.log('Current promotionRules:', existingEndpoint.promotionRules);
    console.log();

    // Test 1: Update with a simple promotion rule (cost > 0)
    const simpleRule = {
      '>': [{ var: 'cost' }, 0]
    };

    console.log('Test 1: Updating with simple rule (cost > 0)...');
    const updated1 = await prisma.api_endpoints.update({
      where: { id: existingEndpoint.id },
      data: { promotionRules: simpleRule }
    });

    console.log('✅ Updated successfully');
    console.log('   New promotionRules:', updated1.promotionRules);
    console.log();

    // Test 2: Test the rule with sample data
    console.log('Test 2: Testing rule with sample data...');
    const testData1 = { cost: 1500, category: 'Rental', status: 'ACTIVE' };
    const testData2 = { cost: 0, category: 'Rental', status: 'ACTIVE' };

    const result1 = jsonLogic.apply(simpleRule as any, testData1);
    const result2 = jsonLogic.apply(simpleRule as any, testData2);

    console.log(`   Test Record 1 (cost=1500): ${result1 ? '✅ PASS' : '❌ REJECT'}`);
    console.log(`   Test Record 2 (cost=0): ${result2 ? '✅ PASS' : '❌ REJECT'}`);
    console.log();

    // Test 3: Update with complex AND rule
    const complexRule = {
      and: [
        { '>': [{ var: 'cost' }, 0] },
        { '==': [{ var: 'status' }, 'ACTIVE'] }
      ]
    };

    console.log('Test 3: Updating with complex rule (cost > 0 AND status = ACTIVE)...');
    const updated2 = await prisma.api_endpoints.update({
      where: { id: existingEndpoint.id },
      data: { promotionRules: complexRule }
    });

    console.log('✅ Updated successfully');
    console.log('   New promotionRules:', JSON.stringify(updated2.promotionRules, null, 2));
    console.log();

    // Test 4: Test complex rule with sample data
    console.log('Test 4: Testing complex rule with sample data...');
    const testData3 = { cost: 1500, category: 'Rental', status: 'ACTIVE' };
    const testData4 = { cost: 1500, category: 'Rental', status: 'DISCONTINUED' };

    const result3 = jsonLogic.apply(complexRule as any, testData3);
    const result4 = jsonLogic.apply(complexRule as any, testData4);

    console.log(`   Test Record 3 (cost=1500, status=ACTIVE): ${result3 ? '✅ PASS' : '❌ REJECT'}`);
    console.log(`   Test Record 4 (cost=1500, status=DISCONTINUED): ${result4 ? '✅ PASS' : '❌ REJECT'}`);
    console.log();

    // Restore original promotionRules
    console.log('Restoring original promotionRules...');
    await prisma.api_endpoints.update({
      where: { id: existingEndpoint.id },
      data: { promotionRules: existingEndpoint.promotionRules || [] }
    });
    console.log('✅ Restored original promotionRules\n');

    // Test 5: Verify schema supports empty rules
    console.log('Test 5: Clearing promotion rules (should default to [])...');
    const updated3 = await prisma.api_endpoints.update({
      where: { id: existingEndpoint.id },
      data: { promotionRules: [] }
    });

    console.log('✅ Updated successfully');
    console.log('   New promotionRules:', updated3.promotionRules);
    console.log('   Type:', Array.isArray(updated3.promotionRules) ? 'Array' : 'Object');
    console.log();

    // Restore original again
    await prisma.api_endpoints.update({
      where: { id: existingEndpoint.id },
      data: { promotionRules: existingEndpoint.promotionRules || [] }
    });

    console.log('✅ All tests passed! Promotion rules field is working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testPromotionRules().catch(console.error);
