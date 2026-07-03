import { useState } from 'react';
import {
  Loader2,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertOctagon,
  Star,
  Copy,
  Check,
  RefreshCw,
  User,
} from 'lucide-react';

import { useGenerateStandupMutation } from '../aiApi';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StandupGeneratorProps {
  projectId: string;
  sprintId: string;
  teamMembers?: { id: string; displayName: string }[];
}

export function StandupGenerator({
  projectId,
  sprintId,
  teamMembers = [],
}: StandupGeneratorProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const [generateStandup, { data: standup, isLoading, error, reset }] =
    useGenerateStandupMutation();

  const handleGenerate = async () => {
    try {
      await generateStandup({
        projectId,
        sprintId,
        userId: selectedUserId || undefined,
      }).unwrap();
    } catch (err) {
      console.error('Failed to generate standup:', err);
    }
  };

  const handleCopy = () => {
    if (!standup) return;

    const text = formatStandupAsText(standup);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatStandupAsText = (data: typeof standup) => {
    if (!data) return '';

    let text = `# Standup Report\n\n`;
    text += `${data.summary}\n\n`;

    if (data.completedYesterday?.length) {
      text += `## Completed Yesterday\n`;
      data.completedYesterday.forEach((item) => {
        text += `- ${item}\n`;
      });
      text += `\n`;
    }

    if (data.inProgress?.length) {
      text += `## In Progress\n`;
      data.inProgress.forEach((item) => {
        text += `- ${item}\n`;
      });
      text += `\n`;
    }

    if (data.plannedToday?.length) {
      text += `## Planned for Today\n`;
      data.plannedToday.forEach((item) => {
        text += `- ${item}\n`;
      });
      text += `\n`;
    }

    if (data.blockers?.length) {
      text += `## Blockers\n`;
      data.blockers.forEach((item) => {
        text += `- ${item}\n`;
      });
      text += `\n`;
    }

    return text;
  };

  const handleReset = () => {
    reset();
    setSelectedUserId('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          AI Standup Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!standup ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate an AI-powered standup report based on recent activity and
              current issue status.
            </p>

            {teamMembers.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Team Member (Optional)</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All team members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All team members</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {member.displayName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Generate Standup
                </>
              )}
            </Button>

            {error && (
              <p className="text-sm text-destructive">
                Failed to generate standup. Please try again.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-primary/5 p-3 rounded-lg">
              <p className="text-sm font-medium">{standup.summary}</p>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {/* Completed Yesterday */}
                {standup.completedYesterday?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">
                        Completed Yesterday
                      </span>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {standup.completedYesterday.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground list-disc"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* In Progress */}
                {standup.inProgress?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">In Progress</span>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {standup.inProgress.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground list-disc"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Planned Today */}
                {standup.plannedToday?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">Planned for Today</span>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {standup.plannedToday.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground list-disc"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Blockers */}
                {standup.blockers?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertOctagon className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Blockers</span>
                      <Badge variant="destructive" className="text-xs">
                        {standup.blockers.length}
                      </Badge>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {standup.blockers.map((item, i) => (
                        <li key={i} className="text-sm text-red-600 list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Highlights */}
                {standup.highlights?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Highlights</span>
                    </div>
                    <ul className="space-y-1 pl-6">
                      {standup.highlights.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-muted-foreground list-disc"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                New Report
              </Button>
              <Button size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Generated in {standup.processingTimeMs}ms
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
