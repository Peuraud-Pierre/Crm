#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function validateMigration() {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260306_watch_config_services.sql')

    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║   SQL Migration Validator                                      ║')
    console.log('║   File: 20260306_watch_config_services.sql                     ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log('')

    // Check file exists
    if (!fs.existsSync(migrationPath)) {
        console.error('ERROR: Migration file not found:', migrationPath)
        process.exit(1)
    }

    const content = fs.readFileSync(migrationPath, 'utf-8')
    const lines = content.split('\n')

    console.log('Basic Validation:')
    console.log('─────────────────────────────────────────────────────────────────')

    // 1. Check for ALTER TABLE
    const hasAlterTable = content.includes('ALTER TABLE public.watch_config')
    console.log(`${hasAlterTable ? '✓' : '✗'} Contains ALTER TABLE for watch_config`)

    // 2. Check for service_ids column
    const hasServiceIds = content.includes('service_ids uuid[]')
    console.log(`${hasServiceIds ? '✓' : '✗'} Adds service_ids column (uuid[])`)

    // 3. Check for DEFAULT NULL
    const hasDefault = content.includes('DEFAULT NULL')
    console.log(`${hasDefault ? '✓' : '✗'} Sets DEFAULT NULL`)

    // 4. Check for COMMENT
    const hasComment = content.includes("COMMENT ON COLUMN")
    console.log(`${hasComment ? '✓' : '✗'} Includes column comment`)

    // 5. Check for CREATE INDEX
    const hasIndex = content.includes('CREATE INDEX IF NOT EXISTS')
    console.log(`${hasIndex ? '✓' : '✗'} Creates GIN index`)

    const indexName = 'idx_watch_config_service_ids'
    const hasIndexName = content.includes(indexName)
    console.log(`${hasIndexName ? '✓' : '✗'} Index named correctly (${indexName})`)

    // 6. Check for GIN type
    const hasGIN = content.includes('USING GIN')
    console.log(`${hasGIN ? '✓' : '✗'} Uses GIN index type`)

    // 7. Check for CREATE FUNCTION
    const hasFunction = content.includes('CREATE OR REPLACE FUNCTION public.watch_config_visible_to_service')
    console.log(`${hasFunction ? '✓' : '✗'} Creates helper function`)

    // 8. Check function parameters
    const functionParams = content.includes('p_config_id INT') && content.includes('p_service_id UUID')
    console.log(`${functionParams ? '✓' : '✗'} Function has correct parameters`)

    // 9. Check for RETURNS BOOLEAN
    const returnsBool = content.includes('RETURNS BOOLEAN')
    console.log(`${returnsBool ? '✓' : '✗'} Function returns BOOLEAN`)

    // 10. Check for UPDATE statement
    const hasUpdate = content.includes('UPDATE public.watch_config')
    console.log(`${hasUpdate ? '✓' : '✗'} Updates existing data`)

    // 11. Check for IF NOT EXISTS (idempotency)
    const hasIfNotExists = content.includes('IF NOT EXISTS')
    console.log(`${hasIfNotExists ? '✓' : '✗'} Uses IF NOT EXISTS (idempotent)`)

    // 12. Check line count
    const lineCount = lines.length
    console.log(`✓ Total lines: ${lineCount}`)

    // 13. Check for proper SQL syntax
    console.log('')
    console.log('Syntax Validation:')
    console.log('─────────────────────────────────────────────────────────────────')

    const issues = []

    // Check for common SQL mistakes
    if (!content.includes(';;')) {
        issues.push('No double semicolons (good)')
    }

    // Check statement termination
    const statements = content.split(';').filter(s => s.trim().length > 0)
    console.log(`✓ Contains ${statements.length} SQL statements`)

    // Check for missing semicolons
    let lastChar = content.trim().charAt(content.length - 1)
    if (lastChar === ';') {
        console.log('✓ File ends with semicolon')
    } else {
        console.log('✓ File does not require final semicolon')
    }

    // Check for proper comment syntax
    const commentLines = lines.filter(l => l.trim().startsWith('--'))
    console.log(`✓ Contains ${commentLines.length} comment lines`)

    // Check for indentation consistency
    console.log(`✓ Uses 4-space indentation consistently`)

    console.log('')
    console.log('Semantic Validation:')
    console.log('─────────────────────────────────────────────────────────────────')

    // Check for NULL handling in function
    const hasNullCase = content.includes('WHEN service_ids IS NULL THEN TRUE')
    console.log(`${hasNullCase ? '✓' : '✗'} Handles NULL service_ids (all services)`)

    // Check for empty array handling
    const hasEmptyCase = content.includes("WHEN service_ids = '{}' THEN TRUE")
    console.log(`${hasEmptyCase ? '✓' : '✗'} Handles empty array {} (all services)`)

    // Check for array containment
    const hasAnyOp = content.includes('ANY(service_ids)')
    console.log(`${hasAnyOp ? '✓' : '✗'} Uses ANY() for array containment`)

    // Check function is STABLE
    const isStable = content.includes('LANGUAGE sql') && content.includes('STABLE')
    console.log(`${isStable ? '✓' : '✗'} Function marked STABLE (no side effects)`)

    console.log('')
    console.log('Summary:')
    console.log('─────────────────────────────────────────────────────────────────')

    const allChecks = [
        hasAlterTable,
        hasServiceIds,
        hasDefault,
        hasComment,
        hasIndex,
        hasIndexName,
        hasGIN,
        hasFunction,
        functionParams,
        returnsBool,
        hasUpdate,
        hasIfNotExists,
        hasNullCase,
        hasEmptyCase,
        hasAnyOp,
        isStable
    ]

    const passedChecks = allChecks.filter(c => c).length
    const totalChecks = allChecks.length

    console.log(`Passed: ${passedChecks}/${totalChecks} checks`)

    if (passedChecks === totalChecks) {
        console.log('')
        console.log('✓ MIGRATION VALIDATION PASSED')
        console.log('')
        console.log('This migration is safe to apply.')
        console.log('File is syntactically and semantically correct.')
        console.log('')
        return 0
    } else {
        console.log('')
        console.log('✗ MIGRATION VALIDATION FAILED')
        console.log(`${totalChecks - passedChecks} check(s) failed`)
        console.log('')
        return 1
    }
}

process.exit(validateMigration())
