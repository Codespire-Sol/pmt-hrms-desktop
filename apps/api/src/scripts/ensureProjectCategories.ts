import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';

type DefaultProjectCategory = {
  name: string;
  description: string;
  color: string;
  icon: string;
  position: number;
};

const DEFAULT_PROJECT_CATEGORIES: DefaultProjectCategory[] = [
  {
    name: 'Software',
    description: 'Software development and product engineering projects',
    color: '#2563EB',
    icon: 'code',
    position: 0,
  },
  {
    name: 'Marketing',
    description: 'Campaigns, brand, and growth marketing projects',
    color: '#F59E0B',
    icon: 'megaphone',
    position: 1,
  },
  {
    name: 'Operations',
    description: 'Operations, process improvement, and delivery projects',
    color: '#10B981',
    icon: 'briefcase',
    position: 2,
  },
  {
    name: 'Human Resources',
    description: 'Recruitment, people operations, and HR initiatives',
    color: '#8B5CF6',
    icon: 'users',
    position: 3,
  },
  {
    name: 'Finance',
    description: 'Budgeting, accounting, and financial planning projects',
    color: '#14B8A6',
    icon: 'bar-chart-3',
    position: 4,
  },
  {
    name: 'Sales',
    description: 'Pipeline, enablement, and sales execution projects',
    color: '#EF4444',
    icon: 'trending-up',
    position: 5,
  },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function ensureProjectCategories(): Promise<void> {
  const totalCategories = await prisma.projectCategory.count();
  if (totalCategories > 0) {
    return;
  }

  await prisma.projectCategory.createMany({
    data: DEFAULT_PROJECT_CATEGORIES.map((category) => ({
      name: category.name,
      slug: slugify(category.name),
      description: category.description,
      color: category.color,
      icon: category.icon,
      position: category.position,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  logger.info(
    `Seeded default project categories: ${DEFAULT_PROJECT_CATEGORIES.map((item) => item.name).join(', ')}`
  );
}

if (require.main === module) {
  ensureProjectCategories()
    .then(() => {
      logger.info('Project category seed completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Project category seed failed:', error);
      process.exit(1);
    });
}
