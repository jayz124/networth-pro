import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const prismaClientSingleton = () => {
    let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';

    // Resolve relative file: URLs to absolute paths for better-sqlite3.
    // DATABASE_URL paths are relative to the prisma/ directory (where schema.prisma lives).
    if (dbUrl.startsWith('file:') && !dbUrl.startsWith('file:/')) {
        const filePath = dbUrl.replace('file:', '');
        const prismaDir = path.resolve(process.cwd(), 'prisma');
        const absolutePath = path.resolve(prismaDir, filePath);
        dbUrl = `file:${absolutePath}`;
    }

    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
