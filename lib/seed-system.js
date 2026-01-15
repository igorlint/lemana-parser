const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding system user...');

    // Check if user 1 exists
    const existing = await prisma.user.findUnique({
        where: { id: 1 }
    });

    if (!existing) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                id: 1,
                email: 'admin@lemana.pro',
                password: hashedPassword,
                name: 'System Admin'
            }
        });
        console.log('✅ Created system user with ID 1');
    } else {
        console.log('ℹ️ System user already exists');
    }
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
