import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import {
  useGenerateAutomationMutation,
  useSuggestAutomationsMutation,
  useValidateAutomationRuleMutation,
  useExplainAutomationRuleMutation,
  useOptimizeAutomationRulesMutation,
} from '../aiApi';
import type { AutomationRule, AutomationSuggestion } from '../types';

interface AutomationGeneratorProps {
  projectId?: string;
  availableFields?: string[];
  availableStatuses?: string[];
}

export const AutomationGenerator: React.FC<AutomationGeneratorProps> = ({
  projectId,
  availableFields = ['status', 'priority', 'assignee', 'labels', 'due_date'],
  availableStatuses = ['To Do', 'In Progress', 'In Review', 'Done'],
}) => {
  const [activeTab, setActiveTab] = useState('generate');
  const [description, setDescription] = useState('');
  const [generatedRule, setGeneratedRule] = useState<AutomationRule | null>(null);
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([]);
  const [existingRules, setExistingRules] = useState<AutomationRule[]>([]);

  const [generateAutomation, { isLoading: isGenerating }] = useGenerateAutomationMutation();
  const [suggestAutomations, { isLoading: isSuggesting }] = useSuggestAutomationsMutation();
  const [validateRule, { data: validationData, isLoading: isValidating }] =
    useValidateAutomationRuleMutation();
  const [explainRule, { data: explanationData, isLoading: isExplaining }] =
    useExplainAutomationRuleMutation();
  const [optimizeRules, { data: optimizationData, isLoading: isOptimizing }] =
    useOptimizeAutomationRulesMutation();

  const handleGenerate = async () => {
    if (!description.trim()) return;
    const result = await generateAutomation({
      description,
      projectContext: projectId ? { projectId } : undefined,
      availableFields,
      availableStatuses,
    });
    if ('data' in result && result.data) {
      setGeneratedRule(result.data.rule);
    }
  };

  const handleSuggest = async () => {
    const result = await suggestAutomations({
      projectContext: { projectId: projectId || 'default' },
    });
    if ('data' in result && result.data) {
      setSuggestions(result.data.suggestions);
    }
  };

  const handleValidate = async (rule: AutomationRule) => {
    await validateRule({ rule });
  };

  const handleExplain = async (rule: AutomationRule) => {
    await explainRule({ rule });
  };

  const handleOptimize = async () => {
    if (existingRules.length === 0) return;
    await optimizeRules({ rules: existingRules });
  };

  const renderRule = (rule: AutomationRule, showActions = true) => (
    <div className="border rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{rule.name}</h4>
          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
            {rule.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        {showActions && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleValidate(rule)}>
              Validate
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExplain(rule)}>
              Explain
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Trigger</Badge>
          <span>{rule.trigger.replace(/_/g, ' ')}</span>
        </div>

        {rule.conditions.length > 0 && (
          <div>
            <span className="font-medium">Conditions:</span>
            <ul className="list-disc list-inside ml-2">
              {rule.conditions.map((cond, i) => (
                <li key={i}>
                  {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <span className="font-medium">Actions:</span>
          <ul className="list-disc list-inside ml-2">
            {rule.actions.map((action, i) => (
              <li key={i}>
                {action.type.replace(/_/g, ' ')}
                {action.delayMinutes && ` (after ${action.delayMinutes} minutes)`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Automation Generator
        </CardTitle>
        <CardDescription>
          Create workflow automations using natural language or get AI-powered suggestions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generate">Generate Rule</TabsTrigger>
            <TabsTrigger value="suggest">Get Suggestions</TabsTrigger>
            <TabsTrigger value="optimize">Optimize Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="description">Describe your automation in natural language</Label>
              <Textarea
                id="description"
                placeholder="e.g., When a bug is created with high priority, assign it to the team lead and send a notification to the QA channel"
                className="min-h-[100px] mt-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={isGenerating || !description.trim()}>
                {isGenerating ? 'Generating...' : 'Generate Automation'}
              </Button>
            </div>

            {generatedRule && (
              <div className="mt-4">
                <h3 className="font-medium mb-3">Generated Automation Rule</h3>
                {renderRule(generatedRule)}

                {validationData && (
                  <Alert className={validationData.isValid ? 'border-green-500' : 'border-red-500'}>
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">
                          {validationData.isValid ? 'Rule is valid' : 'Validation issues found'}
                        </p>
                        {validationData.errors.length > 0 && (
                          <ul className="list-disc list-inside text-red-600">
                            {validationData.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                        {validationData.warnings.length > 0 && (
                          <ul className="list-disc list-inside text-yellow-600">
                            {validationData.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        )}
                        {validationData.suggestions.length > 0 && (
                          <ul className="list-disc list-inside text-blue-600">
                            {validationData.suggestions.map((sug, i) => (
                              <li key={i}>{sug}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {explanationData && (
                  <div className="mt-4 bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Rule Explanation</h4>
                    <p className="mb-2">{explanationData.summary}</p>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="trigger">
                        <AccordionTrigger>When it triggers</AccordionTrigger>
                        <AccordionContent>{explanationData.triggerExplanation}</AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="conditions">
                        <AccordionTrigger>Conditions</AccordionTrigger>
                        <AccordionContent>{explanationData.conditionsExplanation}</AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="actions">
                        <AccordionTrigger>Actions performed</AccordionTrigger>
                        <AccordionContent>{explanationData.actionsExplanation}</AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="example">
                        <AccordionTrigger>Example scenario</AccordionTrigger>
                        <AccordionContent>{explanationData.exampleScenario}</AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggest" className="mt-4 space-y-4">
            <Button onClick={handleSuggest} disabled={isSuggesting}>
              {isSuggesting ? 'Analyzing project...' : 'Get Automation Suggestions'}
            </Button>

            {suggestions.length > 0 && (
              <ScrollArea className="h-[400px]">
                {suggestions.map((suggestion, i) => (
                  <div key={i} className="border rounded-lg p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{suggestion.name}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {Math.round(suggestion.confidence * 100)}% confident
                        </Badge>
                        {suggestion.estimatedTimeSaved && (
                          <Badge variant="secondary">
                            Saves {suggestion.estimatedTimeSaved}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                    <p className="text-sm text-green-600 mb-3">{suggestion.benefit}</p>
                    {renderRule(suggestion.rule, false)}
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => setGeneratedRule(suggestion.rule)}
                    >
                      Use This Rule
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="optimize" className="mt-4 space-y-4">
            <Alert>
              <AlertDescription>
                Add your existing automation rules to get optimization suggestions.
              </AlertDescription>
            </Alert>

            <Button onClick={handleOptimize} disabled={isOptimizing || existingRules.length === 0}>
              {isOptimizing ? 'Optimizing...' : 'Optimize Rules'}
            </Button>

            {optimizationData && (
              <div className="space-y-4">
                <p className="text-sm">{optimizationData.overallAssessment}</p>

                {optimizationData.redundantRules.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Redundant Rules</h4>
                    {optimizationData.redundantRules.map((r, i) => (
                      <div key={i} className="border rounded p-3 mb-2">
                        <p className="text-sm">Rules: {r.ruleIds.join(', ')}</p>
                        <p className="text-sm text-muted-foreground">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {optimizationData.performanceImprovements.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Performance Improvements</h4>
                    <ul className="list-disc list-inside">
                      {optimizationData.performanceImprovements.map((imp, i) => (
                        <li key={i} className="text-sm">{imp}</li>
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

export default AutomationGenerator;
