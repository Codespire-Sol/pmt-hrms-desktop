import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  useGenerateOnboardingChecklistMutation,
  useGetOnboardingNextStepsMutation,
  useGenerateContextualTipsMutation,
  useCreateLearningPathMutation,
  useAnswerOnboardingQuestionMutation,
  useAssessOnboardingReadinessMutation,
  useGenerateWelcomeMessageMutation,
  useSuggestOnboardingBuddyMutation,
} from '../aiApi';
import type {
  OnboardingTask,
  OnboardingChecklist,
  ContextualTip,
  OnboardingUserRole,
  OnboardingTaskPriority,
} from '../types';

const USER_ROLES: Array<{ value: OnboardingUserRole; label: string }> = [
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'qa', label: 'QA Engineer' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'admin', label: 'Administrator' },
  { value: 'stakeholder', label: 'Stakeholder' },
];

const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'experienced', 'expert'];

const PRIORITY_COLORS: Record<OnboardingTaskPriority, string> = {
  required: 'bg-red-500',
  recommended: 'bg-yellow-500',
  optional: 'bg-gray-500',
};

interface OnboardingAssistantProps {
  userId?: string;
  userName?: string;
  projectId?: string;
  projectName?: string;
  teamName?: string;
}

export const OnboardingAssistant: React.FC<OnboardingAssistantProps> = ({
  userId,
  userName = 'New User',
  projectId,
  projectName,
  teamName,
}) => {
  const [activeTab, setActiveTab] = useState('checklist');
  const [userRole, setUserRole] = useState<OnboardingUserRole>('developer');
  const [experience, setExperience] = useState('intermediate');
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [goal, setGoal] = useState('');

  const [generateChecklist, { isLoading: isGenerating }] =
    useGenerateOnboardingChecklistMutation();
  const [getNextSteps, { data: nextStepsData, isLoading: isGettingSteps }] =
    useGetOnboardingNextStepsMutation();
  const [generateTips, { data: tipsData, isLoading: isGettingTips }] =
    useGenerateContextualTipsMutation();
  const [createLearningPath, { data: learningPathData, isLoading: isCreatingPath }] =
    useCreateLearningPathMutation();
  const [answerQuestion, { data: answerData, isLoading: isAnswering }] =
    useAnswerOnboardingQuestionMutation();
  const [assessReadiness, { data: readinessData, isLoading: isAssessing }] =
    useAssessOnboardingReadinessMutation();
  const [generateWelcome, { data: welcomeData, isLoading: isGeneratingWelcome }] =
    useGenerateWelcomeMessageMutation();
  const [suggestBuddy, { data: buddyData, isLoading: isSuggestingBuddy }] =
    useSuggestOnboardingBuddyMutation();

  const handleGenerateChecklist = async () => {
    const result = await generateChecklist({
      userRole,
      userExperience: experience,
      projectContext: projectId ? { projectId, projectName } : undefined,
      teamContext: teamName ? { teamName } : undefined,
    });
    if ('data' in result && result.data) {
      setChecklist(result.data.checklist);
      setCompletedTasks([]);
    }
  };

  const handleTaskToggle = (taskId: string) => {
    setCompletedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleGetNextSteps = async () => {
    await getNextSteps({
      completedTasks,
      userRole,
    });
  };

  const handleGetTips = async (page: string) => {
    await generateTips({
      currentPage: page,
      userRole,
      userExperience: experience,
      completedTasks,
    });
  };

  const handleCreateLearningPath = async () => {
    if (!goal.trim()) return;
    await createLearningPath({
      userRole,
      goal,
    });
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    await answerQuestion({
      question,
      userRole,
      projectContext: projectId ? { projectId, projectName } : undefined,
    });
  };

  const handleAssessReadiness = async () => {
    await assessReadiness({
      userRole,
      completedTasks,
      timeSpent: 60, // Mock time spent
    });
  };

  const handleGenerateWelcome = async () => {
    await generateWelcome({
      userName,
      userRole,
      teamName,
      projectName,
    });
  };

  const handleSuggestBuddy = async () => {
    await suggestBuddy({
      newUserRole: userRole,
    });
  };

  const progress = checklist
    ? (completedTasks.length / checklist.tasks.length) * 100
    : 0;

  const renderTask = (task: OnboardingTask) => (
    <div
      key={task.id}
      className={`border rounded-lg p-4 mb-2 ${
        completedTasks.includes(task.id) ? 'bg-green-50 dark:bg-green-900/20' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={completedTasks.includes(task.id)}
          onCheckedChange={() => handleTaskToggle(task.id)}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-medium ${
                completedTasks.includes(task.id) ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {task.title}
            </span>
            <Badge className={PRIORITY_COLORS[task.priority]} variant="outline">
              {task.priority}
            </Badge>
            <Badge variant="outline">{task.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{task.estimatedMinutes} min</span>
            {task.dependencies.length > 0 && (
              <span>Depends on: {task.dependencies.join(', ')}</span>
            )}
          </div>
          {task.tips.length > 0 && (
            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs">
              <strong>Tips:</strong> {task.tips.join(' ')}
            </div>
          )}
          {task.resources.length > 0 && (
            <div className="mt-2 flex gap-2">
              {task.resources.map((resource, i) => (
                <a
                  key={i}
                  href={resource.url}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {resource.title}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Onboarding Assistant
        </CardTitle>
        <CardDescription>
          Personalized onboarding experience powered by AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="role">Your Role</Label>
            <Select value={userRole} onValueChange={(v) => setUserRole(v as OnboardingUserRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="experience">Experience Level</Label>
            <Select value={experience} onValueChange={setExperience}>
              <SelectTrigger>
                <SelectValue placeholder="Select experience" />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="learning">Learning Path</TabsTrigger>
            <TabsTrigger value="help">Get Help</TabsTrigger>
            <TabsTrigger value="welcome">Welcome</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="mt-4 space-y-4">
            <Button onClick={handleGenerateChecklist} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Personalized Checklist'}
            </Button>

            {checklist && (
              <div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{checklist.title}</h3>
                    <span className="text-sm text-muted-foreground">
                      {completedTasks.length} / {checklist.tasks.length} completed
                    </span>
                  </div>
                  <Progress value={progress} className="mb-2" />
                  <p className="text-sm text-muted-foreground">{checklist.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated total time: {checklist.estimatedTotalMinutes} minutes
                  </p>
                </div>

                <ScrollArea className="h-[400px]">
                  {checklist.tasks.map(renderTask)}
                </ScrollArea>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={handleGetNextSteps} disabled={isGettingSteps}>
                    {isGettingSteps ? 'Loading...' : 'Get Next Steps'}
                  </Button>
                  <Button variant="outline" onClick={handleAssessReadiness} disabled={isAssessing}>
                    {isAssessing ? 'Assessing...' : 'Check Readiness'}
                  </Button>
                </div>

                {nextStepsData && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Recommended Next Steps</h4>
                    {nextStepsData.nextSteps.map(renderTask)}
                  </div>
                )}

                {readinessData && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Readiness Score: {Math.round((readinessData.readinessScore || 0) * 100)}%
                          </span>
                          <Badge variant={readinessData.isReady ? 'default' : 'secondary'}>
                            {readinessData.isReady ? 'Ready' : 'In Progress'}
                          </Badge>
                        </div>
                        {readinessData.strengths.length > 0 && (
                          <p className="text-sm text-green-600">
                            Strengths: {readinessData.strengths.join(', ')}
                          </p>
                        )}
                        {readinessData.gaps.length > 0 && (
                          <p className="text-sm text-orange-600">
                            Areas to improve: {readinessData.gaps.join(', ')}
                          </p>
                        )}
                        <p className="text-sm">Next milestone: {readinessData.nextMilestone}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="learning" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="goal">What do you want to learn?</Label>
              <Textarea
                id="goal"
                placeholder="e.g., I want to master the sprint planning process"
                className="mt-2"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <Button onClick={handleCreateLearningPath} disabled={isCreatingPath || !goal.trim()}>
              {isCreatingPath ? 'Creating...' : 'Create Learning Path'}
            </Button>

            {learningPathData && learningPathData.learningPath && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">{learningPathData.learningPath.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {learningPathData.learningPath.description}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Estimated duration: {learningPathData.learningPath.estimatedDuration}
                </p>

                <div className="space-y-4">
                  {learningPathData.learningPath.milestones.map((milestone, i) => (
                    <div key={i} className="border-l-2 border-blue-500 pl-4">
                      <h4 className="font-medium">{milestone.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{milestone.description}</p>
                      <ul className="list-disc list-inside text-sm">
                        {milestone.tasks.map((task, j) => (
                          <li key={j}>
                            {task.title} ({task.durationMinutes} min) - {task.type}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <h4 className="font-medium mb-2">Skills You'll Gain</h4>
                  <div className="flex flex-wrap gap-2">
                    {learningPathData.learningPath.skillsGained.map((skill, i) => (
                      <Badge key={i} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="help" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="question">Ask a Question</Label>
              <Textarea
                id="question"
                placeholder="e.g., How do I create my first sprint?"
                className="mt-2"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            <Button onClick={handleAskQuestion} disabled={isAnswering || !question.trim()}>
              {isAnswering ? 'Finding answer...' : 'Ask'}
            </Button>

            {answerData && (
              <div className="border rounded-lg p-4">
                <p className="mb-4">{answerData.answer}</p>

                {answerData.relatedResources.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-sm mb-2">Related Resources</h4>
                    <div className="flex flex-wrap gap-2">
                      {answerData.relatedResources.map((resource, i) => (
                        <a
                          key={i}
                          href={resource.url}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {resource.title} ({resource.type})
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {answerData.followUpSuggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">You might also want to know:</h4>
                    <ul className="list-disc list-inside text-sm">
                      {answerData.followUpSuggestions.map((suggestion, i) => (
                        <li
                          key={i}
                          className="cursor-pointer text-blue-600 hover:underline"
                          onClick={() => setQuestion(suggestion)}
                        >
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => handleGetTips('dashboard')}
              disabled={isGettingTips}
            >
              {isGettingTips ? 'Loading...' : 'Get Contextual Tips'}
            </Button>

            {tipsData && tipsData.tips.length > 0 && (
              <div className="space-y-2">
                {tipsData.tips.map((tip: ContextualTip) => (
                  <Alert key={tip.id}>
                    <AlertDescription>
                      <h4 className="font-medium">{tip.title}</h4>
                      <p className="text-sm">{tip.content}</p>
                      {tip.action && (
                        <Button size="sm" variant="link" className="p-0 h-auto mt-2">
                          {tip.action.label}
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="welcome" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleGenerateWelcome} disabled={isGeneratingWelcome}>
                {isGeneratingWelcome ? 'Generating...' : 'Generate Welcome Message'}
              </Button>
              <Button variant="outline" onClick={handleSuggestBuddy} disabled={isSuggestingBuddy}>
                {isSuggestingBuddy ? 'Finding...' : 'Find Onboarding Buddy'}
              </Button>
            </div>

            {welcomeData && (
              <div className="border rounded-lg p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <h2 className="text-2xl font-bold mb-2">{welcomeData.greeting}</h2>
                <p className="mb-4">{welcomeData.introduction}</p>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2">Your First Step</h4>
                  <p className="text-sm">{welcomeData.firstStep}</p>
                </div>
                {welcomeData.helpfulContacts.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">People Who Can Help</h4>
                    <div className="space-y-1">
                      {welcomeData.helpfulContacts.map((contact, i) => (
                        <p key={i} className="text-sm">
                          <strong>{contact.role}:</strong> {contact.description}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {welcomeData.funFact && (
                  <p className="text-sm italic text-muted-foreground">
                    Fun fact: {welcomeData.funFact}
                  </p>
                )}
              </div>
            )}

            {buddyData && buddyData.suggestedBuddies.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Suggested Onboarding Buddies</h3>
                <div className="space-y-3">
                  {buddyData.suggestedBuddies.map((buddy, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-3">
                      <div>
                        <p className="font-medium">{buddy.name}</p>
                        <p className="text-sm text-muted-foreground">{buddy.reason}</p>
                        <div className="flex gap-1 mt-1">
                          {buddy.complementarySkills.map((skill, j) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge>{Math.round(buddy.matchScore * 100)}% match</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {buddyData.pairingTips.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-sm mb-2">Pairing Tips</h4>
                    <ul className="list-disc list-inside text-sm">
                      {buddyData.pairingTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default OnboardingAssistant;
