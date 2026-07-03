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
import { Separator } from '@/components/ui/separator';
import {
  useDefineTermMutation,
  useExtractTermsMutation,
  useCheckTerminologyConsistencyMutation,
  useGenerateGlossaryMutation,
  useTranslateJargonMutation,
  useSuggestTermImprovementsMutation,
} from '../aiApi';
import type { GlossaryTerm, TermSuggestion, TermUsage, TermCategory } from '../types';

const CATEGORY_COLORS: Record<TermCategory, string> = {
  technical: 'bg-blue-500',
  business: 'bg-green-500',
  process: 'bg-purple-500',
  domain: 'bg-orange-500',
  acronym: 'bg-red-500',
  jargon: 'bg-yellow-500',
};

interface TerminologyHelperProps {
  projectId?: string;
  domain?: string;
  glossary?: Array<Record<string, unknown>>;
}

export const TerminologyHelper: React.FC<TerminologyHelperProps> = ({
  projectId,
  domain,
  glossary = [],
}) => {
  const [activeTab, setActiveTab] = useState('define');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [definedTerms, setDefinedTerms] = useState<GlossaryTerm[]>([]);

  const [defineTerm, { data: definitionData, isLoading: isDefining }] =
    useDefineTermMutation();
  const [extractTerms, { data: extractedData, isLoading: isExtracting }] =
    useExtractTermsMutation();
  const [checkConsistency, { data: consistencyData, isLoading: isChecking }] =
    useCheckTerminologyConsistencyMutation();
  const [generateGlossary, { data: glossaryData, isLoading: isGenerating }] =
    useGenerateGlossaryMutation();
  const [translateJargon, { data: translatedData, isLoading: isTranslating }] =
    useTranslateJargonMutation();
  const [suggestImprovements, { data: improvementsData, isLoading: isSuggesting }] =
    useSuggestTermImprovementsMutation();

  const handleDefine = async () => {
    if (!term.trim()) return;
    const result = await defineTerm({
      term,
      context: context || undefined,
      projectDomain: domain,
    });
    if ('data' in result && result.data) {
      setDefinedTerms((prev) => [...prev, result.data.term]);
      setTerm('');
    }
  };

  const handleExtract = async () => {
    if (!content.trim()) return;
    await extractTerms({
      content,
      existingTerms: definedTerms.map((t) => t.term),
      domain,
    });
  };

  const handleCheckConsistency = async () => {
    if (!content.trim()) return;
    await checkConsistency({
      content,
      glossary: definedTerms.map((t) => ({
        term: t.term,
        definition: t.definition,
      })),
    });
  };

  const handleGenerateGlossary = async () => {
    if (!content.trim()) return;
    await generateGlossary({
      documents: [{ title: 'Document', content }],
      domain,
    });
  };

  const handleTranslate = async () => {
    if (!content.trim()) return;
    await translateJargon({
      text: content,
      glossary: definedTerms.map((t) => ({
        term: t.term,
        definition: t.definition,
      })),
      targetLevel: 'beginner',
    });
  };

  const handleSuggestImprovements = async () => {
    if (definedTerms.length === 0) return;
    await suggestImprovements({
      glossary: definedTerms.map((t) => ({
        term: t.term,
        definition: t.definition,
        category: t.category,
      })),
    });
  };

  const renderTerm = (glossaryTerm: GlossaryTerm) => (
    <div key={glossaryTerm.id} className="border rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium">{glossaryTerm.term}</h4>
        <Badge className={CATEGORY_COLORS[glossaryTerm.category]}>
          {glossaryTerm.category}
        </Badge>
      </div>
      <p className="text-sm mb-2">{glossaryTerm.definition}</p>

      {glossaryTerm.aliases.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground">Also known as: </span>
          <span className="text-xs">{glossaryTerm.aliases.join(', ')}</span>
        </div>
      )}

      {glossaryTerm.examples.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground">Examples:</span>
          <ul className="list-disc list-inside text-xs">
            {glossaryTerm.examples.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
          </ul>
        </div>
      )}

      {glossaryTerm.relatedTerms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-muted-foreground">Related:</span>
          {glossaryTerm.relatedTerms.map((related, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {related}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  const renderSuggestion = (suggestion: TermSuggestion) => (
    <div key={suggestion.term} className="border rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{suggestion.term}</span>
          <Badge className={CATEGORY_COLORS[suggestion.category]} variant="outline">
            {suggestion.category}
          </Badge>
        </div>
        <Badge variant="secondary">
          {Math.round(suggestion.confidence * 100)}% confident
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{suggestion.suggestedDefinition}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-muted-foreground">
          Found {suggestion.occurrences} times
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setTerm(suggestion.term);
            setContext(suggestion.suggestedDefinition);
            setActiveTab('define');
          }}
        >
          Add to Glossary
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Terminology Helper
        </CardTitle>
        <CardDescription>
          Build and maintain a project glossary with AI-powered definitions and consistency checks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="define">Define Terms</TabsTrigger>
            <TabsTrigger value="extract">Extract Terms</TabsTrigger>
            <TabsTrigger value="consistency">Check Consistency</TabsTrigger>
            <TabsTrigger value="translate">Translate Jargon</TabsTrigger>
          </TabsList>

          <TabsContent value="define" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="term">Term to Define</Label>
                <Input
                  id="term"
                  placeholder="e.g., Sprint, Backlog, User Story"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="context">Context (optional)</Label>
                <Input
                  id="context"
                  placeholder="How this term is used in your project"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleDefine} disabled={isDefining || !term.trim()}>
              {isDefining ? 'Defining...' : 'Define Term'}
            </Button>

            {definitionData && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Latest Definition</h3>
                {renderTerm(definitionData.term)}
              </div>
            )}

            {definedTerms.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Project Glossary ({definedTerms.length} terms)</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSuggestImprovements}
                    disabled={isSuggesting}
                  >
                    {isSuggesting ? 'Analyzing...' : 'Get Improvement Suggestions'}
                  </Button>
                </div>
                <ScrollArea className="h-[300px]">
                  {definedTerms.map(renderTerm)}
                </ScrollArea>
              </div>
            )}

            {improvementsData && (
              <Alert>
                <AlertDescription>
                  <p className="font-medium mb-2">
                    Quality Score: {Math.round((improvementsData.qualityScore || 0) * 100)}%
                  </p>
                  <p className="text-sm mb-2">{improvementsData.overallFeedback}</p>
                  {improvementsData.improvements.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm font-medium">Suggested improvements:</span>
                      <ul className="list-disc list-inside text-sm">
                        {improvementsData.improvements.map((imp, i) => (
                          <li key={i}>
                            <strong>{imp.term}:</strong> {imp.suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {improvementsData.missingTerms.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Consider adding:</span>
                      <p className="text-sm">{improvementsData.missingTerms.join(', ')}</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="extract" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="extractContent">Content to Analyze</Label>
              <Textarea
                id="extractContent"
                placeholder="Paste documentation, requirements, or any project content to extract technical terms..."
                className="min-h-[150px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExtract} disabled={isExtracting || !content.trim()}>
                {isExtracting ? 'Extracting...' : 'Extract Terms'}
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateGlossary}
                disabled={isGenerating || !content.trim()}
              >
                {isGenerating ? 'Generating...' : 'Generate Full Glossary'}
              </Button>
            </div>

            {extractedData && extractedData.terms.length > 0 && (
              <ScrollArea className="h-[300px]">
                <h3 className="font-medium mb-2">
                  Extracted Terms ({extractedData.terms.length})
                </h3>
                {extractedData.terms.map(renderSuggestion)}
              </ScrollArea>
            )}

            {glossaryData && glossaryData.terms.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">
                  Generated Glossary ({glossaryData.terms.length} terms)
                </h3>
                <ScrollArea className="h-[300px]">
                  {glossaryData.terms.map(renderTerm)}
                </ScrollArea>
                <Button
                  className="mt-2"
                  onClick={() => setDefinedTerms((prev) => [...prev, ...glossaryData.terms])}
                >
                  Add All to Project Glossary
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="consistency" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="checkContent">Content to Check</Label>
              <Textarea
                id="checkContent"
                placeholder="Paste content to check for consistent terminology usage..."
                className="min-h-[150px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <Button
              onClick={handleCheckConsistency}
              disabled={isChecking || !content.trim() || definedTerms.length === 0}
            >
              {isChecking ? 'Checking...' : 'Check Consistency'}
            </Button>

            {definedTerms.length === 0 && (
              <Alert>
                <AlertDescription>
                  Add some terms to your glossary first to check consistency.
                </AlertDescription>
              </Alert>
            )}

            {consistencyData && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {Math.round((consistencyData.consistencyScore || 0) * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Consistency Score</p>
                  </div>
                </div>

                {consistencyData.usages.filter((u: TermUsage) => !u.isConsistent).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Inconsistent Usage Found</h4>
                    <ScrollArea className="h-[200px]">
                      {consistencyData.usages
                        .filter((u: TermUsage) => !u.isConsistent)
                        .map((usage: TermUsage, i: number) => (
                          <div key={i} className="border rounded p-3 mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="destructive">{usage.term}</Badge>
                              <span className="text-xs text-muted-foreground">
                                at {usage.location}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{usage.context}</p>
                            {usage.suggestedReplacement && (
                              <p className="text-sm text-green-600 mt-1">
                                Suggested: {usage.suggestedReplacement}
                              </p>
                            )}
                          </div>
                        ))}
                    </ScrollArea>
                  </div>
                )}

                {consistencyData.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside text-sm">
                      {consistencyData.recommendations.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="translate" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="jargonContent">Jargon-Heavy Content</Label>
              <Textarea
                id="jargonContent"
                placeholder="Paste technical content to translate into simpler language..."
                className="min-h-[150px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <Button onClick={handleTranslate} disabled={isTranslating || !content.trim()}>
              {isTranslating ? 'Translating...' : 'Simplify Jargon'}
            </Button>

            {translatedData && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Simplified Version</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{translatedData.translatedText}</p>
                  </div>
                </div>

                {translatedData.changesMade.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Changes Made</h4>
                    <div className="space-y-1">
                      {translatedData.changesMade.map((change, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="line-through text-red-500">{change.original}</span>
                          <span>→</span>
                          <span className="text-green-500">{change.replacement}</span>
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
};

export default TerminologyHelper;
