import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  RefreshCw,
  Network,
  Target,
  Maximize2,
  ZoomIn,
  ZoomOut,
  GitBranch,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Layers,
  Eye,
  Play,
  Settings,
  Info,
} from 'lucide-react';
import {
  useBuildRiskGraphMutation,
  useAnalyzeNodeImpactMutation,
  useRunWhatIfAnalysisMutation,
  useGetRiskSummaryQuery,
  useGetRiskLevelsQuery,
} from '../aiApi';
import type {
  RiskNode,
  RiskEdge,
  RiskCluster,
  RiskGraphResponse,
  ImpactAnalysisResponse,
  WhatIfAnalysisResponse,
} from '../types';

interface RiskVisualizationGraphProps {
  projectId: string;
  sprintId?: string;
  onNodeClick?: (nodeId: string) => void;
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-red-500', border: 'border-red-600', text: 'text-red-700' },
  high: { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-500', border: 'border-yellow-600', text: 'text-yellow-700' },
  low: { bg: 'bg-green-500', border: 'border-green-600', text: 'text-green-700' },
  none: { bg: 'bg-gray-300', border: 'border-gray-400', text: 'text-gray-600' },
};

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  issue: <Target className="h-4 w-4" />,
  epic: <Layers className="h-4 w-4" />,
  blocker: <AlertTriangle className="h-4 w-4" />,
  dependency: <GitBranch className="h-4 w-4" />,
};

export function RiskVisualizationGraph({
  projectId,
  sprintId,
  onNodeClick,
}: RiskVisualizationGraphProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<RiskGraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<RiskNode | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysisResponse | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfAnalysisResponse | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [maxDepth, setMaxDepth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [showWhatIfDialog, setShowWhatIfDialog] = useState(false);
  const [whatIfScenario, setWhatIfScenario] = useState('');
  const [whatIfChanges, setWhatIfChanges] = useState<Array<{ nodeId: string; field: string; newValue: string }>>([]);

  const { data: riskSummary, refetch: refetchSummary } = useGetRiskSummaryQuery(projectId);
  const { data: riskLevels } = useGetRiskLevelsQuery();
  const [buildGraph, { isLoading: isBuilding }] = useBuildRiskGraphMutation();
  const [analyzeImpact, { isLoading: isAnalyzing }] = useAnalyzeNodeImpactMutation();
  const [runWhatIf, { isLoading: isRunningWhatIf }] = useRunWhatIfAnalysisMutation();

  const handleBuildGraph = useCallback(async () => {
    try {
      const result = await buildGraph({
        projectId,
        sprintId,
        includeResolved: showResolved,
        maxDepth,
      }).unwrap();

      setGraphData(result);
      setSelectedNode(null);
      setImpactAnalysis(null);
    } catch (error) {
      console.error('Failed to build risk graph:', error);
    }
  }, [projectId, sprintId, showResolved, maxDepth, buildGraph]);

  const handleNodeSelect = useCallback(
    async (node: RiskNode) => {
      setSelectedNode(node);
      onNodeClick?.(node.id);

      try {
        const impact = await analyzeImpact({
          nodeId: node.id,
          projectId,
        }).unwrap();
        setImpactAnalysis(impact);
      } catch (error) {
        console.error('Failed to analyze impact:', error);
      }
    },
    [projectId, analyzeImpact, onNodeClick]
  );

  const handleRunWhatIf = useCallback(async () => {
    if (!whatIfScenario.trim() || whatIfChanges.length === 0) return;

    try {
      const result = await runWhatIf({
        projectId,
        scenario: whatIfScenario,
        changes: whatIfChanges.map((c) => ({
          nodeId: c.nodeId,
          field: c.field,
          newValue: c.newValue,
        })),
      }).unwrap();

      setWhatIfResult(result);
      setShowWhatIfDialog(false);
    } catch (error) {
      console.error('Failed to run what-if analysis:', error);
    }
  }, [projectId, whatIfScenario, whatIfChanges, runWhatIf]);

  const addWhatIfChange = useCallback(() => {
    if (selectedNode) {
      setWhatIfChanges((prev) => [
        ...prev,
        { nodeId: selectedNode.id, field: 'status', newValue: 'resolved' },
      ]);
    }
  }, [selectedNode]);

  const removeWhatIfChange = useCallback((index: number) => {
    setWhatIfChanges((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Calculate node positions for visualization
  const nodePositions = useMemo(() => {
    if (!graphData?.nodes) return new Map<string, { x: number; y: number }>();

    const positions = new Map<string, { x: number; y: number }>();
    const nodes = graphData.nodes;
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Simple force-directed layout simulation
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const radius = 200 + (node.riskLevel === 'critical' ? 0 : node.riskLevel === 'high' ? 50 : 100);
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return positions;
  }, [graphData?.nodes]);

  const getRiskColor = (level: string) => RISK_COLORS[level] || RISK_COLORS.none;

  useEffect(() => {
    handleBuildGraph();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Graph Area */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-500" />
                Risk Dependency Graph
              </CardTitle>
              <CardDescription>
                Interactive visualization of project risks and dependencies
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="icon" onClick={handleBuildGraph}>
                <RefreshCw className={`h-4 w-4 ${isBuilding ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-resolved"
                checked={showResolved}
                onCheckedChange={setShowResolved}
              />
              <Label htmlFor="show-resolved" className="text-sm">
                Show Resolved
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="depth" className="text-sm">
                Depth:
              </Label>
              <Select value={String(maxDepth)} onValueChange={(v) => setMaxDepth(Number(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={showWhatIfDialog} onOpenChange={setShowWhatIfDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  What-If Analysis
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>What-If Analysis</DialogTitle>
                  <DialogDescription>
                    Simulate changes and see how they affect project risk
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Scenario Description</Label>
                    <Textarea
                      placeholder="Describe the scenario you want to analyze..."
                      value={whatIfScenario}
                      onChange={(e) => setWhatIfScenario(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Changes</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addWhatIfChange}
                        disabled={!selectedNode}
                      >
                        Add Selected Node
                      </Button>
                    </div>
                    {whatIfChanges.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Select a node and add it to simulate changes
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {whatIfChanges.map((change, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 border rounded-lg"
                          >
                            <span className="text-sm flex-1">
                              {change.nodeId}: {change.field} → {change.newValue}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeWhatIfChange(idx)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowWhatIfDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRunWhatIf} disabled={isRunningWhatIf}>
                    {isRunningWhatIf ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Analysis
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Graph Visualization */}
          <div
            ref={canvasRef}
            className="relative border rounded-lg bg-muted/20 overflow-hidden"
            style={{ height: '500px' }}
          >
            {isBuilding ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : graphData?.nodes && graphData.nodes.length > 0 ? (
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 800 600"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              >
                {/* Draw edges */}
                {graphData.edges.map((edge) => {
                  const from = nodePositions.get(edge.source);
                  const to = nodePositions.get(edge.target);
                  if (!from || !to) return null;
                  return (
                    <g key={edge.id}>
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={edge.isCriticalPath ? '#ef4444' : '#9ca3af'}
                        strokeWidth={edge.isCriticalPath ? 3 : 1}
                        strokeDasharray={edge.type === 'blocks' ? '5,5' : undefined}
                        markerEnd="url(#arrowhead)"
                      />
                    </g>
                  );
                })}

                {/* Arrow marker definition */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                  </marker>
                </defs>

                {/* Draw nodes */}
                {graphData.nodes.map((node) => {
                  const pos = nodePositions.get(node.id);
                  if (!pos) return null;
                  const colors = getRiskColor(node.riskLevel);
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => handleNodeSelect(node)}
                      className="cursor-pointer"
                    >
                      <circle
                        r={node.isOnCriticalPath ? 30 : 25}
                        className={`${colors.bg} ${isSelected ? 'stroke-primary stroke-2' : ''}`}
                        fill={
                          node.riskLevel === 'critical'
                            ? '#ef4444'
                            : node.riskLevel === 'high'
                            ? '#f97316'
                            : node.riskLevel === 'medium'
                            ? '#eab308'
                            : node.riskLevel === 'low'
                            ? '#22c55e'
                            : '#9ca3af'
                        }
                        opacity={0.8}
                      />
                      <text
                        textAnchor="middle"
                        dy="4"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {node.title.slice(0, 8)}...
                      </text>
                      {node.isOnCriticalPath && (
                        <circle
                          r={35}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2"
                          strokeDasharray="4,2"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No risk data available</p>
                  <Button variant="outline" className="mt-2" onClick={handleBuildGraph}>
                    Build Graph
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500" />
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span>Low</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-t-2 border-dashed border-red-500" />
              <span>Critical Path</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side Panel */}
      <div className="space-y-4">
        {/* Risk Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Risk Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskSummary ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overall Score</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={100 - riskSummary.overallRiskScore * 10}
                      className="w-20 h-2"
                    />
                    <Badge
                      className={
                        riskSummary.overallRiskScore >= 7
                          ? 'bg-red-500'
                          : riskSummary.overallRiskScore >= 4
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }
                    >
                      {riskSummary.overallRiskScore.toFixed(1)}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-red-500">Critical</span>
                    <Badge variant="outline">{riskSummary.criticalCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-500">High</span>
                    <Badge variant="outline">{riskSummary.highCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-500">Medium</span>
                    <Badge variant="outline">{riskSummary.mediumCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-500">Low</span>
                    <Badge variant="outline">{riskSummary.lowCount}</Badge>
                  </div>
                </div>
                {riskSummary.topRisks && riskSummary.topRisks.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Top Risks</Label>
                      <ul className="mt-1 space-y-1">
                        {riskSummary.topRisks.slice(0, 3).map((risk, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground">
                            • {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading summary...</p>
            )}
          </CardContent>
        </Card>

        {/* Selected Node Details */}
        {selectedNode && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                Node Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Title</Label>
                <p className="font-medium">{selectedNode.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <div className="flex items-center gap-1 mt-1">
                    {NODE_TYPE_ICONS[selectedNode.type] || <Target className="h-4 w-4" />}
                    <span className="capitalize">{selectedNode.type}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Risk Level</Label>
                  <Badge className={`mt-1 ${getRiskColor(selectedNode.riskLevel).bg} text-white`}>
                    {selectedNode.riskLevel}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge variant="outline" className="mt-1">
                  {selectedNode.status}
                </Badge>
              </div>
              {selectedNode.isOnCriticalPath && (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    On Critical Path
                  </span>
                </div>
              )}
              {selectedNode.blockedBy && selectedNode.blockedBy.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Blocked By ({selectedNode.blockedBy.length})
                  </Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.blockedBy.map((id) => (
                      <Badge key={id} variant="outline" className="text-xs">
                        {id.slice(0, 8)}...
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Impact Analysis */}
        {impactAnalysis && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                Impact Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Affected Nodes</Label>
                  <p className="font-medium">{impactAnalysis.affectedNodes.length}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Impact Score</Label>
                  <p className="font-medium">{impactAnalysis.impactScore.toFixed(1)}</p>
                </div>
              </div>
              {impactAnalysis.cascadeEffects && impactAnalysis.cascadeEffects.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Cascade Effects</Label>
                  <ul className="mt-1 space-y-1">
                    {impactAnalysis.cascadeEffects.slice(0, 3).map((effect, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        • {effect}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {impactAnalysis.recommendations && impactAnalysis.recommendations.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Recommendations</Label>
                  <ul className="mt-1 space-y-1">
                    {impactAnalysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-blue-600 dark:text-blue-400">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* What-If Results */}
        {whatIfResult && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Play className="h-4 w-4 text-green-500" />
                What-If Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Scenario</Label>
                <p className="text-sm">{whatIfResult.scenario}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Before</Label>
                  <Badge className={getRiskColor(whatIfResult.originalRisk).bg}>
                    {whatIfResult.originalRisk}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">After</Label>
                  <Badge className={getRiskColor(whatIfResult.projectedRisk).bg}>
                    {whatIfResult.projectedRisk}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {whatIfResult.riskDelta < 0 ? (
                  <TrendingDown className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  Risk change: {whatIfResult.riskDelta > 0 ? '+' : ''}{whatIfResult.riskDelta.toFixed(1)}
                </span>
              </div>
              {whatIfResult.recommendations && whatIfResult.recommendations.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Recommendations</Label>
                  <ul className="mt-1 space-y-1">
                    {whatIfResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default RiskVisualizationGraph;
