# Transcript Feedback - Fix Status

## ✅ FIXED (9 items)
1. ✅ **Input fields not accepting input** - Added `stopPropagation()` to all inputs/selects/textareas
2. ✅ **Dropdown selections not working** - Fixed with stopPropagation
3. ✅ **ReactFlow branding at bottom** - Hidden with CSS
4. ✅ **Agent framework names** - Updated: react→one-shot, autogpt→recursive, metagpt→multi-role, autogen→collaborative

## 🔴 CRITICAL - NEEDS IMMEDIATE FIX (6 items)
1. ✅ **Model selection should be dropdown, not text input** - FIXED: Now dropdown with enum values
2. ✅ **OCR providers wrong** - FIXED: Updated to ['paddle', 'easyocr', 'tesseract', 'google', 'docktr', 'nlweb', 'omniparser']
3. ✅ **Vision API provider wrong** - FIXED: Changed to ['google'] only (Google Vision)
4. ✅ **Missing system prompt field for AI agents** - FIXED: Added systemPrompt field to ai.agent config
5. ❌ **Can't select created agents in AI agent nodes** - Need to add agent selection dropdown
6. ❌ **Can't delete nodes/workflows** - Delete functionality not working
7. ❌ **Can't upload files for image analysis** - File upload input missing
8. ❌ **Can't create teams** - Teams creation not working
9. ❌ **Can't delete API keys** - API key deletion not working
10. ❌ **Clerk login redirect issue** - Stuck on /login/factor-one

## 🟡 HIGH PRIORITY (8 items)
11. ❌ **Tools should allow selecting apps** - Currently only built-in tools
12. ❌ **Email monitoring should be hidden from non-admin users** - Currently visible to all
13. ❌ **RAG pipeline not working** - Functionality issue
14. ❌ **Auto-redirect issue when navigating** - Panel closes unexpectedly
15. ❌ **While loop code editor visibility** - Disappears when zoomed
16. ❌ **Triggers and schedules should be in workflow builder** - Currently separate
17. ✅ **OSINT should be renamed to "Social Media Monitoring"** - FIXED: Updated labels and page title
18. ❌ **Connector selection UI needs improvement** - Should show logo + company name like Make.com

## 🟢 MEDIUM PRIORITY (4 items)
19. ❌ **Chat to create workflow option not visible** - Feature missing
20. ❌ **Need documentation for while loop code** - Documentation needed
21. ❌ **Text-to-speech model needs improvement** - Quality issue
22. ❌ **Provider can be more than anthropic and openai** - Future enhancement

## Notes
- Most input field issues should be resolved with stopPropagation fixes
- Agent framework names are updated but backend may need mapping
- Many features need backend support (teams, API keys, file uploads)

