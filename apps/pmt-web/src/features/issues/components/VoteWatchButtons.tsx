import { useState } from 'react';
import { ThumbsUp, Eye, EyeOff, Users } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Separator } from '../../../components/ui/separator';
import {
  useAddVoteMutation,
  useRemoveVoteMutation,
  useGetVotersQuery,
  useAddWatcherMutation,
  useRemoveWatcherMutation,
  useGetWatchersQuery,
} from '../issuesApi';

interface VoteWatchButtonsProps {
  issueId: string;
  initialVoteCount?: number;
  initialWatcherCount?: number;
  initialHasVoted?: boolean;
  initialIsWatching?: boolean;
  compact?: boolean;
}

export function VoteWatchButtons({
  issueId,
  initialVoteCount = 0,
  initialWatcherCount = 0,
  initialHasVoted = false,
  initialIsWatching = false,
  compact = false,
}: VoteWatchButtonsProps) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [watcherCount, setWatcherCount] = useState(initialWatcherCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [isWatching, setIsWatching] = useState(initialIsWatching);

  const [addVote, { isLoading: isAddingVote }] = useAddVoteMutation();
  const [removeVote, { isLoading: isRemovingVote }] = useRemoveVoteMutation();
  const [addWatcher, { isLoading: isAddingWatcher }] = useAddWatcherMutation();
  const [removeWatcher, { isLoading: isRemovingWatcher }] = useRemoveWatcherMutation();

  const { data: votersData, isLoading: isLoadingVoters } = useGetVotersQuery(issueId);
  const { data: watchersData, isLoading: isLoadingWatchers } = useGetWatchersQuery(issueId);

  const handleVoteToggle = async () => {
    try {
      if (hasVoted) {
        const result = await removeVote(issueId).unwrap();
        setVoteCount(result.voteCount);
        setHasVoted(result.hasVoted);
      } else {
        const result = await addVote(issueId).unwrap();
        setVoteCount(result.voteCount);
        setHasVoted(result.hasVoted);
      }
    } catch (error) {
      console.error('Failed to toggle vote:', error);
    }
  };

  const handleWatchToggle = async () => {
    try {
      if (isWatching) {
        const result = await removeWatcher({ issueId }).unwrap();
        setWatcherCount(result.watcherCount);
        setIsWatching(result.isWatching);
      } else {
        const result = await addWatcher({ issueId }).unwrap();
        setWatcherCount(result.watcherCount);
        setIsWatching(result.isWatching);
      }
    } catch (error) {
      console.error('Failed to toggle watch:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isVoteLoading = isAddingVote || isRemovingVote;
  const isWatchLoading = isAddingWatcher || isRemovingWatcher;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={hasVoted ? 'default' : 'outline'}
                size="sm"
                onClick={handleVoteToggle}
                disabled={isVoteLoading}
                className="h-7 px-2"
              >
                <ThumbsUp className={`h-3.5 w-3.5 ${hasVoted ? 'fill-current' : ''}`} />
                <span className="ml-1 text-xs">{voteCount}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hasVoted ? 'Remove vote' : 'Vote for this issue'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isWatching ? 'default' : 'outline'}
                size="sm"
                onClick={handleWatchToggle}
                disabled={isWatchLoading}
                className="h-7 px-2"
              >
                {isWatching ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                <span className="ml-1 text-xs">{watcherCount}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isWatching ? 'Stop watching' : 'Watch this issue'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Vote Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThumbsUp className={`h-4 w-4 ${hasVoted ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium">Votes</span>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Users className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">{voteCount}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Voters ({voteCount})</h4>
              </div>
              <ScrollArea className="h-48">
                {isLoadingVoters ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : votersData?.voters && votersData.voters.length > 0 ? (
                  <div className="p-2">
                    {votersData.voters.map((voter) => (
                      <div
                        key={voter.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={voter.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {getInitials(voter.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {voter.displayName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No votes yet
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button
            variant={hasVoted ? 'default' : 'outline'}
            size="sm"
            onClick={handleVoteToggle}
            disabled={isVoteLoading}
          >
            {hasVoted ? 'Voted' : 'Vote'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Watch Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className={`h-4 w-4 ${isWatching ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium">Watchers</span>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Users className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">{watcherCount}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Watchers ({watcherCount})</h4>
              </div>
              <ScrollArea className="h-48">
                {isLoadingWatchers ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : watchersData?.watchers && watchersData.watchers.length > 0 ? (
                  <div className="p-2">
                    {watchersData.watchers.map((watcher) => (
                      <div
                        key={watcher.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={watcher.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {getInitials(watcher.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {watcher.displayName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    No watchers yet
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button
            variant={isWatching ? 'default' : 'outline'}
            size="sm"
            onClick={handleWatchToggle}
            disabled={isWatchLoading}
          >
            {isWatching ? 'Watching' : 'Watch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
