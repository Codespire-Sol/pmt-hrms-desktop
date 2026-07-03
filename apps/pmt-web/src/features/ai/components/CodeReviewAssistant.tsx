import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useAnalyzePRMutation,
  useReviewCodeSnippetMutation,
  useSuggestCodeImprovementsMutation,
  useCheckCodeSecurityMutation,
  useSuggestTestsForCodeMutation,
} from '../aiApi';
import type {
  CodeComment,
  ReviewSeverity,
  ReviewCategory,
  CodeSuggestion,
} from '../types';

const LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'csharp',
  'ruby',
  'php',
];

const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
};

const CATEGORY_ICONS: Record<ReviewCategory, string> = {
  bug: 'Bug',
  security: 'Security',
  performance: 'Performance',
  maintainability: 'Maintainability',
  style: 'Style',
  documentation: 'Docs',
  testing: 'Testing',
  best_practice: 'Best Practice',
};

interface CodeReviewAssistantProps {
  projectId?: string;
}

export const CodeReviewAssistant: React.FC<CodeReviewAssistantProps> = ({
  projectId,
}) => {
  const [activeTab, setActiveTab] = useState('snippet');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [context, setContext] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  const [reviewSnippet, { data: reviewData, isLoading: isReviewing }] =
    useReviewCodeSnippetMutation();
  const [suggestImprovements, { data: improvementsData, isLoading: isImproving }] =
    useSuggestCodeImprovementsMutation();
  const [checkSecurity, { data: securityData, isLoading: isCheckingSecurity }] =
    useCheckCodeSecurityMutation();
  const [suggestTests, { data: testsData, isLoading: isSuggestingTests }] =
    useSuggestTestsForCodeMutation();

  const handleReviewCode = async () => {
    if (!code.trim()) return;
    await reviewSnippet({
      code,
      language,
      context: context || undefined,
      focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
    });
  };

  const handleSuggestImprovements = async () => {
    if (!code.trim()) return;
    await suggestImprovements({ code, language });
  };

  const handleSecurityCheck = async () => {
    if (!code.trim()) return;
    await checkSecurity({ code, language });
  };

  const handleSuggestTests = async () => {
    if (!code.trim()) return;
    await suggestTests({ code, language });
  };

  const renderComment = (comment: CodeComment) => (
    <div key={comment.id} className="border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge className={SEVERITY_COLORS[comment.severity]}>
          {comment.severity.toUpperCase()}
        </Badge>
        <Badge variant="outline">{CATEGORY_ICONS[comment.category]}</Badge>
        {comment.lineStart && (
          <span className="text-sm text-muted-foreground">
            Line {comment.lineStart}
            {comment.lineEnd && comment.lineEnd !== comment.lineStart && ` - ${comment.lineEnd}`}
          </span>
        )}
      </div>
      <p className="font-medium mb-2">{comment.message}</p>
      {comment.explanation && (
        <p className="text-sm text-muted-foreground mb-2">{comment.explanation}</p>
      )}
      {comment.suggestion && (
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md mt-2">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Suggestion: {comment.suggestion}
          </p>
        </div>
      )}
      {comment.codeSnippet && (
        <pre className="bg-muted p-3 rounded-md mt-2 text-sm overflow-x-auto">
          <code>{comment.codeSnippet}</code>
        </pre>
      )}
    </div>
  );

  const renderImprovement = (suggestion: CodeSuggestion, index: number) => (
    <div key={index} className="border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline">{suggestion.category}</Badge>
        <Badge variant={suggestion.impact === 'high' ? 'destructive' : 'secondary'}>
          {suggestion.impact} impact
        </Badge>
      </div>
      <p className="text-sm mb-3">{suggestion.explanation}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
          <pre className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs overflow-x-auto">
            <code>{suggestion.originalCode}</code>
          </pre>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Suggested</p>
          <pre className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-xs overflow-x-auto">
            <code>{suggestion.suggestedCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Code Review Assistant
        </CardTitle>
        <CardDescription>
          Get AI-powered code reviews, security analysis, and improvement suggestions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="snippet">Review Code</TabsTrigger>
            <TabsTrigger value="improvements">Improvements</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="tests">Test Suggestions</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="context">Context (optional)</Label>
                <Input
                  id="context"
                  placeholder="e.g., This is a React component..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="code">Code to Review</Label>
              <Textarea
                id="code"
                placeholder="Paste your code here..."
                className="font-mono min-h-[200px]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="snippet" className="mt-4">
            <Button
              onClick={handleReviewCode}
              disabled={isReviewing || !code.trim()}
              className="mb-4"
            >
              {isReviewing ? 'Reviewing...' : 'Review Code'}
            </Button>

            {reviewData && (
              <ScrollArea className="h-[400px]">
                {reviewData.comments.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No issues found. The code looks good!
                    </AlertDescription>
                  </Alert>
                ) : (
                  reviewData.comments.map(renderComment)
                )}
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="improvements" className="mt-4">
            <Button
              onClick={handleSuggestImprovements}
              disabled={isImproving || !code.trim()}
              className="mb-4"
            >
              {isImproving ? 'Analyzing...' : 'Get Improvement Suggestions'}
            </Button>

            {improvementsData && (
              <ScrollArea className="h-[400px]">
                {improvementsData.suggestions.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No improvements suggested. The code follows best practices.
                    </AlertDescription>
                  </Alert>
                ) : (
                  improvementsData.suggestions.map(renderImprovement)
                )}
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <Button
              onClick={handleSecurityCheck}
              disabled={isCheckingSecurity || !code.trim()}
              className="mb-4"
            >
              {isCheckingSecurity ? 'Scanning...' : 'Run Security Check'}
            </Button>

            {securityData && (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {Math.round((securityData.securityScore || 0) * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Security Score</p>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <p className="text-sm">{securityData.summary}</p>
                </div>

                <ScrollArea className="h-[350px]">
                  {securityData.findings.length === 0 ? (
                    <Alert>
                      <AlertDescription>
                        No security vulnerabilities detected.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    securityData.findings.map(renderComment)
                  )}
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tests" className="mt-4">
            <Button
              onClick={handleSuggestTests}
              disabled={isSuggestingTests || !code.trim()}
              className="mb-4"
            >
              {isSuggestingTests ? 'Generating...' : 'Suggest Test Cases'}
            </Button>

            {testsData && (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {testsData.unitTests.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Unit Tests</h4>
                      {testsData.unitTests.map((test, i) => (
                        <div key={i} className="border rounded-lg p-3 mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{test.name}</span>
                            <Badge variant="outline">{test.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {test.description}
                          </p>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            <code>{test.testCode}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {testsData.edgeCases.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Edge Cases to Consider</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {testsData.edgeCases.map((edge, i) => (
                          <li key={i} className="text-sm">{edge}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {testsData.integrationTests.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Integration Tests</h4>
                      {testsData.integrationTests.map((test, i) => (
                        <div key={i} className="border rounded-lg p-3 mb-2">
                          <span className="font-medium">{test.name}</span>
                          <p className="text-sm text-muted-foreground">
                            {test.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {testsData.coverageGaps.length > 0 && (
                    <Alert>
                      <AlertDescription>
                        <strong>Coverage Gaps:</strong>{' '}
                        {testsData.coverageGaps.join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CodeReviewAssistant;
