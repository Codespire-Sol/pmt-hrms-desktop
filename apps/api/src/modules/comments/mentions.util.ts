import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';

/**
 * Regex pattern to match @mentions in comment content.
 * Matches @username where username can contain:
 * - Letters (a-z, A-Z)
 * - Numbers (0-9)
 * - Dots (.)
 * - Underscores (_)
 * - Hyphens (-)
 */
const MENTION_PATTERN = /@([a-zA-Z0-9._-]+)/g;

export interface ExtractedMention {
  username: string;
  startIndex: number;
  endIndex: number;
}

export interface ResolvedMention {
  userId: string;
  username: string;
  displayName: string;
  email: string;
}

/**
 * Extract all @mentions from comment content.
 * Returns an array of usernames (without the @ prefix).
 */
export function extractMentions(content: string): string[] {
  const matches = content.match(MENTION_PATTERN) || [];
  // Remove duplicates and @ prefix
  const usernames = [...new Set(matches.map((m) => m.slice(1)))];
  return usernames;
}

/**
 * Extract mentions with their positions in the content.
 * Useful for highlighting mentions in the UI.
 */
export function extractMentionsWithPositions(content: string): ExtractedMention[] {
  const mentions: ExtractedMention[] = [];
  let match: RegExpExecArray | null;

  // Reset the regex state
  MENTION_PATTERN.lastIndex = 0;

  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    mentions.push({
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Resolve usernames to user IDs.
 * Looks up users by email prefix (before the @) or display_name.
 * Returns only users that exist in the database.
 */
export async function resolveUsernames(
  usernames: string[],
  projectId?: string
): Promise<ResolvedMention[]> {
  if (usernames.length === 0) {
    return [];
  }

  // Build OR conditions for each username to match by email prefix or display name
  const orConditions: Prisma.UserWhereInput[] = [];
  for (const username of usernames) {
    const lowerUsername = username.toLowerCase();
    orConditions.push(
      // Match email prefix (part before @) - case insensitive
      { email: { startsWith: lowerUsername + '@', mode: 'insensitive' } },
    );
  }

  const whereClause: Prisma.UserWhereInput = {
    OR: orConditions,
    deletedAt: null,
  };

  // If project ID provided, filter to project members only
  if (projectId) {
    whereClause.projectMemberships = {
      some: {
        projectId,
      },
    };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  // Map users back to their mentioned usernames
  const resolved: ResolvedMention[] = [];

  for (const user of users) {
    const emailPrefix = user.email.split('@')[0].toLowerCase();
    const displayName = `${user.firstName} ${user.lastName}`.trim();
    const displayNameNormalized = displayName
      .replace(/\s+/g, '')
      .toLowerCase();

    // Find which username matched this user
    for (const username of usernames) {
      const normalizedUsername = username.toLowerCase().replace(/\./g, '');
      if (
        emailPrefix === normalizedUsername ||
        displayNameNormalized === normalizedUsername
      ) {
        // Check if we already added this user
        if (!resolved.some((r) => r.userId === user.id)) {
          resolved.push({
            userId: user.id,
            username,
            displayName,
            email: user.email,
          });
        }
        break;
      }
    }
  }

  return resolved;
}

/**
 * Convert @mentions in content to HTML links.
 * Wraps each valid @mention in a span with mention class.
 */
export function convertMentionsToHtml(
  content: string,
  resolvedMentions: ResolvedMention[]
): string {
  const mentionMap = new Map(
    resolvedMentions.map((m) => [m.username.toLowerCase(), m])
  );

  return content.replace(MENTION_PATTERN, (match, username) => {
    const mention = mentionMap.get(username.toLowerCase());
    if (mention) {
      return `<span class="mention" data-user-id="${mention.userId}">@${mention.displayName}</span>`;
    }
    // Return original if not a valid mention
    return match;
  });
}
