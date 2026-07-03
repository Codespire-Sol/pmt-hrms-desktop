import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  RefreshCw,
  Sparkles,
  TestTube2,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Zap,
  Shield,
  Code2,
  Bug,
  GitBranch,
  Target,
  Clock,
  Wand2,
} from 'lucide-react';
import {
  useGenerateTestCasesMutation,
  useGenerateTestSuiteMutation,
  useGenerateEdgeCasesMutation,
  useGenerateRegressionTestsMutation,
  useAnalyzeTestCoverageMutation,
  useSuggestAutomationCandidatesMutation,
  useGetTestTypesQuery,
  useGetTestPrioritiesQuery,
} from '../aiApi';
import type {
  TestCase,
  TestStep,
  GenerateTestsResponse,
  TestSuiteResponse,
  TestCoverageResponse,
  AutomationCandidatesResponse,
} from '../types';

interface TestCaseGeneratorProps {
  issueId?: string;
  initialTitle?: string;
  initialDescription?: string;
  acceptanceCriteria?: string[];
  projectId?: string;
  onTestCasesGenerated?: (testCases: TestCase[]) => void;
  onTestCaseExport?: (testCases: TestCase[], format: string) => void;
}

const TEST_TYPE_ICONS: Record<string, React.ReactNode> = {
  functional: <Play className="h-4 w-4" />,
  integration: <GitBranch className="h-4 w-4" />,
  e2e: <Target className="h-4 w-4" />,
  unit: <Code2 className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  performance: <Zap className="h-4 w-4" />,
  regression: <RefreshCw className="h-4 w-4" />,
  edge_case: <AlertTriangle className="h-4 w-4" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

export function TestCaseGenerator({
  issueId = 'new',
  initialTitle = '',
  initialDescription = '',
  acceptanceCriteria = [],
  projectId,
  onTestCasesGenerated,
  onTestCaseExport,
}: TestCaseGeneratorProps) {
  const [activeTab, setActiveTab] = useState('generate');
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [criteria, setCriteria] = useState(acceptanceCriteria.join('\n'));
  const [testType, setTestType] = useState<string>('functional');
  const [generatedTests, setGeneratedTests] = useState<TestCase[]>([]);
  const [testSuite, setTestSuite] = useState<TestSuiteResponse | null>(null);
  const [coverage, setCoverage] = useState<TestCoverageResponse | null>(null);
  const [automationCandidates, setAutomationCandidates] = useState<AutomationCandidatesResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());

  const { data: testTypes } = useGetTestTypesQuery();
  const { data: priorities } = useGetTestPrioritiesQuery();
  const [generateTests, { isLoading: isGenerating }] = useGenerateTestCasesMutation();
  const [generateSuite, { isLoading: isGeneratingSuite }] = useGenerateTestSuiteMutation();
  const [generateEdgeCases, { isLoading: isGeneratingEdge }] = useGenerateEdgeCasesMutation();
  const [generateRegression, { isLoading: isGeneratingRegression }] = useGenerateRegressionTestsMutation();
  const [analyzeCoverage, { isLoading: isAnalyzing }] = useAnalyzeTestCoverageMutation();
  const [suggestAutomation, { isLoading: isSuggesting }] = useSuggestAutomationCandidatesMutation();

  const isLoading = isGenerating || isGeneratingSuite || isGeneratingEdge || isGeneratingRegression;

  const handleGenerateTests = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await generateTests({
        issueId,
        title,
        description,
        acceptanceCriteria: criteria.split('\n').filter((c) => c.trim()),
        testType,
      }).unwrap();

      setGeneratedTests(result.testCases);
      if (onTestCasesGenerated) {
        onTestCasesGenerated(result.testCases);
      }
    } catch (error) {
      console.error('Failed to generate test cases:', error);
    }
  }, [issueId, title, description, criteria, testType, generateTests, onTestCasesGenerated]);

  const handleGenerateEdgeCases = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await generateEdgeCases({
        issueId,
        title,
        description,
        existingTests: generatedTests.map((t) => t.title),
      }).unwrap();

      setGeneratedTests((prev) => [...prev, ...result.testCases]);
    } catch (error) {
      console.error('Failed to generate edge cases:', error);
    }
  }, [issueId, title, description, generatedTests, generateEdgeCases]);

  const handleGenerateRegression = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await generateRegression({
        issueId,
        changeDescription: description || title,
      }).unwrap();

      setGeneratedTests((prev) => [...prev, ...result.testCases]);
    } catch (error) {
      console.error('Failed to generate regression tests:', error);
    }
  }, [issueId, title, description, generateRegression]);

  const handleAnalyzeCoverage = useCallback(async () => {
    if (!projectId || generatedTests.length === 0) return;

    try {
      const result = await analyzeCoverage({
        projectId,
        existingTests: generatedTests.map((t) => ({
          name: t.title,
          type: t.testType,
          coveredAreas: t.coveredAreas,
        })),
        issues: [{ id: issueId, title }],
      }).unwrap();

      setCoverage(result);
    } catch (error) {
      console.error('Failed to analyze coverage:', error);
    }
  }, [projectId, generatedTests, issueId, title, analyzeCoverage]);

  const handleSuggestAutomation = useCallback(async () => {
    if (generatedTests.length === 0) return;

    try {
      const result = await suggestAutomation({
        tests: generatedTests.map((t) => ({
          name: t.title,
          type: t.testType,
          steps: t.steps.map((s) => s.action),
        })),
      }).unwrap();

      setAutomationCandidates(result);
    } catch (error) {
      console.error('Failed to suggest automation candidates:', error);
    }
  }, [generatedTests, suggestAutomation]);

  const handleCopyTest = useCallback((test: TestCase) => {
    const testText = `
Test Case: ${test.title}
Type: ${test.testType}
Priority: ${test.priority}
${test.preconditions ? `\nPreconditions:\n${test.preconditions.map((p) => `- ${p}`).join('\n')}` : ''}

Steps:
${test.steps.map((s, i) => `${i + 1}. ${s.action}${s.expectedResult ? `\n   Expected: ${s.expectedResult}` : ''}`).join('\n')}
${test.expectedOutcome ? `\nExpected Outcome: ${test.expectedOutcome}` : ''}
    `.trim();

    navigator.clipboard.writeText(testText);
    setCopiedId(test.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleExportTests = useCallback(
    (format: string) => {
      const testsToExport = selectedTests.size > 0
        ? generatedTests.filter((t) => selectedTests.has(t.id))
        : generatedTests;

      if (onTestCaseExport) {
        onTestCaseExport(testsToExport, format);
      }
    },
    [generatedTests, selectedTests, onTestCaseExport]
  );

  const toggleTestSelection = useCallback((testId: string) => {
    setSelectedTests((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  }, []);

  const selectAllTests = useCallback(() => {
    if (selectedTests.size === generatedTests.length) {
      setSelectedTests(new Set());
    } else {
      setSelectedTests(new Set(generatedTests.map((t) => t.id)));
    }
  }, [generatedTests, selectedTests.size]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube2 className="h-5 w-5 text-green-500" />
          AI Test Case Generator
        </CardTitle>
        <CardDescription>
          Generate comprehensive test cases from issue descriptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="results" disabled={generatedTests.length === 0}>
              Results ({generatedTests.length})
            </TabsTrigger>
            <TabsTrigger value="coverage" disabled={generatedTests.length === 0}>
              Coverage
            </TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Issue Title</Label>
                <Input
                  id="title"
                  placeholder="Enter the issue or feature title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the feature or change..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="criteria">Acceptance Criteria (one per line)</Label>
                <Textarea
                  id="criteria"
                  placeholder="Enter acceptance criteria..."
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  rows={4}
                  className="resize-none font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Test Type</Label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    {testTypes?.types?.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {TEST_TYPE_ICONS[type.value] || <TestTube2 className="h-4 w-4" />}
                          {type.label}
                        </div>
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="functional">Functional</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="e2e">End-to-End</SelectItem>
                        <SelectItem value="unit">Unit</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateTests}
                  disabled={!title.trim() || isLoading}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Test Cases
                </Button>
              </div>
              {generatedTests.length > 0 && (
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={handleGenerateEdgeCases}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          {isGeneratingEdge ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 mr-2" />
                          )}
                          Edge Cases
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate edge case tests</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={handleGenerateRegression}
                          disabled={isLoading}
                          className="flex-1"
                        >
                          {isGeneratingRegression ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Bug className="h-4 w-4 mr-2" />
                          )}
                          Regression
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate regression tests</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4">
            {generatedTests.length > 0 && (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedTests.size === generatedTests.length}
                      onCheckedChange={selectAllTests}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedTests.size > 0 ? `${selectedTests.size} selected` : 'Select all'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportTests('markdown')}
                      disabled={generatedTests.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSuggestAutomation}
                      disabled={isSuggesting || generatedTests.length === 0}
                    >
                      {isSuggesting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      Automation
                    </Button>
                  </div>
                </div>

                {/* Test Cases List */}
                <ScrollArea className="h-[400px]">
                  <Accordion type="single" collapsible className="space-y-2">
                    {generatedTests.map((test, idx) => (
                      <AccordionItem
                        key={test.id || idx}
                        value={test.id || String(idx)}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-3 w-full pr-4">
                            <Checkbox
                              checked={selectedTests.has(test.id)}
                              onCheckedChange={() => toggleTestSelection(test.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2">
                                {TEST_TYPE_ICONS[test.testType] || <TestTube2 className="h-4 w-4" />}
                                <span className="font-medium">{test.title}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {test.testType}
                                </Badge>
                                <Badge
                                  className={`text-xs ${
                                    PRIORITY_COLORS[test.priority] || 'bg-gray-500'
                                  }`}
                                >
                                  {test.priority}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {test.steps.length} steps
                                </span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-4 pl-8">
                            {/* Description */}
                            {test.description && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Description</Label>
                                <p className="text-sm mt-1">{test.description}</p>
                              </div>
                            )}

                            {/* Preconditions */}
                            {test.preconditions && test.preconditions.length > 0 && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Preconditions</Label>
                                <ul className="mt-1 space-y-1">
                                  {test.preconditions.map((pre, pidx) => (
                                    <li key={pidx} className="text-sm flex items-center gap-2">
                                      <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                                      {pre}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Steps */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Test Steps</Label>
                              <div className="mt-2 space-y-2">
                                {test.steps.map((step, sidx) => (
                                  <div
                                    key={step.id || sidx}
                                    className="flex gap-3 p-2 border rounded bg-muted/30"
                                  >
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                                      {step.order || sidx + 1}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{step.action}</p>
                                      {step.testData && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Data: {step.testData}
                                        </p>
                                      )}
                                      {step.expectedResult && (
                                        <div className="flex items-center gap-1 mt-1 text-green-600 dark:text-green-400">
                                          <CheckCircle2 className="h-3 w-3" />
                                          <span className="text-xs">{step.expectedResult}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Expected Outcome */}
                            {test.expectedOutcome && (
                              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                <Label className="text-xs text-green-600 dark:text-green-400">
                                  Expected Outcome
                                </Label>
                                <p className="text-sm mt-1">{test.expectedOutcome}</p>
                              </div>
                            )}

                            {/* Tags */}
                            {test.tags && test.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {test.tags.map((tag, tidx) => (
                                  <Badge key={tidx} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyTest(test)}
                              >
                                {copiedId === test.id ? (
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4 mr-2" />
                                )}
                                Copy
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>

                {/* Automation Candidates */}
                {automationCandidates && (
                  <div className="space-y-3 pt-4">
                    <Separator />
                    <h3 className="font-medium flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-purple-500" />
                      Automation Recommendations
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-500">
                          {automationCandidates.highPriority.length}
                        </p>
                        <p className="text-xs text-muted-foreground">High Priority</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-500">
                          {automationCandidates.mediumPriority?.length || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Medium Priority</p>
                      </div>
                    </div>
                    {automationCandidates.reasoning && (
                      <p className="text-sm text-muted-foreground">
                        {automationCandidates.reasoning}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Coverage Tab */}
          <TabsContent value="coverage" className="space-y-4">
            <Button
              onClick={handleAnalyzeCoverage}
              disabled={isAnalyzing || generatedTests.length === 0}
              className="w-full"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              Analyze Coverage
            </Button>

            {coverage && (
              <div className="space-y-4">
                <Separator />

                {/* Coverage Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Progress value={coverage.overallCoverage * 100} className="w-16" />
                      <span className="text-2xl font-bold">
                        {Math.round(coverage.overallCoverage * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Overall Coverage</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-500">{coverage.coveredAreas}</p>
                    <p className="text-xs text-muted-foreground">Covered Areas</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-500">{coverage.gaps.length}</p>
                    <p className="text-xs text-muted-foreground">Gaps Found</p>
                  </div>
                </div>

                {/* Coverage Gaps */}
                {coverage.gaps.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <Label className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Coverage Gaps
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {coverage.gaps.map((gap, idx) => (
                        <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                          • {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {coverage.recommendations && coverage.recommendations.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <Label className="text-sm text-blue-700 dark:text-blue-300">
                      Recommendations
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {coverage.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-blue-600 dark:text-blue-400">
                          • {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Coverage by Type */}
                {coverage.byType && Object.keys(coverage.byType).length > 0 && (
                  <div>
                    <Label className="text-sm">Coverage by Test Type</Label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(coverage.byType).map(([type, value]) => (
                        <div key={type} className="flex items-center gap-3">
                          <div className="w-24 text-sm capitalize">{type}</div>
                          <Progress value={(value as number) * 100} className="flex-1" />
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {Math.round((value as number) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TestCaseGenerator;
