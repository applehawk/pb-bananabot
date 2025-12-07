const { execSync } = require('child_process');
const fs = require('fs');

function countLines(command) {
    try {
        // Run find command to get file list
        const files = execSync(command, { encoding: 'utf8' }).trim();
        if (!files) return { count: 0, files: 0 };

        const fileList = files.split('\n');
        let totalLines = 0;

        // Count lines for each file using wc -l
        // process in chunks if necessary, but for this project size, all at once usually fine
        // better to loop or xargs if list is huge, but here standard execSync with wc -l is safest per file or total
        // standard `wc -l <files>` might fail if too many arguments.
        // SAFE approach: iterate and sum.

        for (const file of fileList) {
            try {
                const output = execSync(`wc -l "${file}"`, { encoding: 'utf8' }).trim();
                const lines = parseInt(output.split(' ')[0], 10);
                if (!isNaN(lines)) {
                    totalLines += lines;
                }
            } catch (e) {
                console.error(`Error reading ${file}: ${e.message}`);
            }
        }

        return { count: totalLines, files: fileList.length };
    } catch (e) {
        // console.error(`Command failed: ${command}`, e.message);
        return { count: 0, files: 0 };
    }
}

console.log("=== Project Code Statistics (Detailed) ===\n");

const categories = [
    // --- BOT SECTION ---
    {
        name: "Bot: Source Code",
        command: `find src -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*"`,
        description: "Main Bot Logic (src/)"
    },
    {
        name: "Bot: Scripts",
        command: `find scripts -type f \\( -name "*.ts" -o -name "*.js" \\) -not -path "*/node_modules/*"`,
        description: "Bot Utility Scripts (scripts/)"
    },
    {
        name: "Bot: Config/Docker",
        command: `find . -maxdepth 1 -type f \\( -name "Dockerfile*" -o -name "docker-compose*.yml" -o -name "amvera.yml" \\)`,
        description: "Bot/Root Container Config"
    },

    // --- ADMIN SECTION ---
    {
        name: "Admin: Source Code",
        command: `find bananabot-admin/app bananabot-admin/components bananabot-admin/lib bananabot-admin/types -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*"`,
        description: "Admin Panel App Logic"
    },
    {
        name: "Admin: Scripts",
        command: `find bananabot-admin/scripts -type f \\( -name "*.ts" -o -name "*.js" \\) -not -path "*/node_modules/*"`,
        description: "Admin Utility Scripts"
    },
    {
        name: "Admin: Config/Docker",
        command: `find bananabot-admin -maxdepth 1 -type f \\( -name "Dockerfile*" -o -name "docker-compose*.yml" \\)`,
        description: "Admin Container Config"
    },

    // --- SHARED / INFRA SECTION ---
    {
        name: "Shared: Libs & Prisma",
        command: `find libs prisma -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.prisma" \\) -not -path "*/node_modules/*"`,
        description: "Shared Code & Database Schema"
    },
    {
        name: "Shared: Bash/Deploy",
        command: `find deploy -type f -name "*.sh"`,
        description: "Deployment & Maintenance Scripts"
    }
];

let grandTotalLines = 0;
let grandTotalFiles = 0;

// Helper to accumulate totals by group
const totals = {
    "Bot": { lines: 0, files: 0 },
    "Admin": { lines: 0, files: 0 },
    "Shared": { lines: 0, files: 0 }
};

categories.forEach(cat => {
    const result = countLines(cat.command);
    console.log(`--- ${cat.name} ---`);
    console.log(`Files: ${result.files}`);
    console.log(`Lines: ${result.count}`);
    console.log("");

    grandTotalLines += result.count;
    grandTotalFiles += result.files;

    if (cat.name.startsWith("Bot")) {
        totals["Bot"].lines += result.count;
        totals["Bot"].files += result.files;
    } else if (cat.name.startsWith("Admin")) {
        totals["Admin"].lines += result.count;
        totals["Admin"].files += result.files;
    } else {
        totals["Shared"].lines += result.count;
        totals["Shared"].files += result.files;
    }
});

console.log("=== Summary by Component ===");
Object.keys(totals).forEach(key => {
    console.log(`${key.padEnd(8)} | Files: ${String(totals[key].files).padEnd(4)} | Lines: ${totals[key].lines}`);
});
console.log("-".repeat(40));

console.log(`TOTAL    | Files: ${String(grandTotalFiles).padEnd(4)} | Lines: ${grandTotalLines}`);
