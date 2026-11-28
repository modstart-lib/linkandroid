#!/usr/bin/env node
// Keep cli/internal/skill/guide.md in sync with the skill document.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'skills/linkandroid-cli-skill/SKILL.md')
const target = path.join(root, 'cli/internal/skill/guide.md')

const content = fs.readFileSync(source, 'utf-8')
const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : null

if (current === content) {
    console.log('cli/internal/skill/guide.md is up to date')
} else {
    fs.writeFileSync(target, content)
    console.log('synced cli/internal/skill/guide.md')
}
