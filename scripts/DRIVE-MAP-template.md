# DRIVE-MAP — Where Everything Lives

*Copy this file to your project root as DRIVE-MAP.md. Fill in your accounts.*
*This is the first file your AI reads when you ask it to find something.*

---

## How to use this

When you ask your AI to find a file:
1. It reads this file to know which account to look in
2. It opens that account's index (e.g. `drive-indexes/work.md`)  
3. It searches the summaries to find the exact file

Three hops and it knows exactly where everything is.

---

## Your Accounts

<!-- Replace the examples below with your actual accounts -->

## me@example.com — Work
~5,000 files | 25 GB
Work projects, client files, invoices, contracts.
Index: `drive-indexes/work.md`
Summaries: `drive-indexes/work-files.md`

## personal@gmail.com — Personal
~3,000 files | 18 GB  
Photos, health records, travel docs, personal projects.
Index: `drive-indexes/personal.md`
Summaries: `drive-indexes/personal-files.md`

<!-- Add more accounts here as you index them -->

---

## Notes for your AI

- Always start here before searching for any file
- The `-files.md` companion indexes have AI summaries of what's in each file
- If you can't find something in the index, the file may not be indexed yet or may have been added after the last run
- To refresh the indexes, re-run `python3 scripts/file-summarizer.py` in the project folder
