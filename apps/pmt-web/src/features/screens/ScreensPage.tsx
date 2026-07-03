import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, MoreHorizontal, GripVertical, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useGetScreensQuery,
  useGetScreenQuery,
  useCreateScreenMutation,
  useUpdateScreenMutation,
  useDeleteScreenMutation,
  useAddScreenTabMutation,
  useDeleteScreenTabMutation,
  useAddFieldToTabMutation,
  useRemoveFieldFromTabMutation,
  useGetSystemFieldsQuery,
  Screen,
  ScreenWithTabs,
  ScreenTab,
  ScreenTabField,
} from './screensApi';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

export function ScreensPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingScreen, setDeletingScreen] = useState<Screen | null>(null);
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');

  const { data: screens, isLoading } = useGetScreensQuery({});
  const { data: systemFields } = useGetSystemFieldsQuery();
  const { data: selectedScreen, isLoading: isLoadingScreen } = useGetScreenQuery(selectedScreenId!, {
    skip: !selectedScreenId,
  });

  const [createScreen, { isLoading: isCreating }] = useCreateScreenMutation();
  const [deleteScreen, { isLoading: isDeleting }] = useDeleteScreenMutation();

  const filteredScreens = screens?.filter((screen) =>
    screen.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateScreen = async (data: { name: string; description?: string }) => {
    try {
      const screen = await createScreen(data).unwrap();
      toast({ title: 'Screen created successfully' });
      setShowCreateDialog(false);
      setSelectedScreenId(screen.id);
    } catch {
      toast({ title: 'Error', description: 'Failed to create screen', variant: 'destructive' });
    }
  };

  const handleDeleteScreen = async () => {
    if (!deletingScreen) return;
    try {
      await deleteScreen(deletingScreen.id).unwrap();
      toast({ title: 'Screen deleted successfully' });
      if (selectedScreenId === deletingScreen.id) {
        setSelectedScreenId(null);
      }
      setDeletingScreen(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete screen', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Screens</h1>
          <p className="text-muted-foreground">Configure fields displayed on issue forms</p>
        </div>
        {canUpdateProject && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Screen
          </Button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Screen List */}
        <div className="col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search screens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : filteredScreens?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No screens found</p>
              ) : (
                filteredScreens?.map((screen) => (
                  <button
                    key={screen.id}
                    onClick={() => setSelectedScreenId(screen.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                      selectedScreenId === screen.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{screen.name}</div>
                      {screen.isSystem && (
                        <Badge variant="secondary" className="text-xs mt-1">System</Badge>
                      )}
                    </div>
                    {!screen.isSystem && canUpdateProject && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeletingScreen(screen); }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Screen Details */}
        <div className="col-span-8">
          {selectedScreenId ? (
            isLoadingScreen ? (
              <Card>
                <CardContent className="py-8">
                  <Skeleton className="h-8 w-1/3 mb-4" />
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            ) : selectedScreen ? (
              <ScreenEditor screen={selectedScreen} systemFields={systemFields || []} canUpdateProject={canUpdateProject} />
            ) : null
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Select a screen to view and edit its fields
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <CreateScreenDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateScreen}
        isLoading={isCreating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingScreen} onOpenChange={(open) => !open && setDeletingScreen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screen</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingScreen?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScreen}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ScreenEditorProps {
  screen: ScreenWithTabs;
  systemFields: { id: string; label: string; type: string; required?: boolean }[];
  canUpdateProject: boolean;
}

function ScreenEditor({ screen, systemFields, canUpdateProject }: ScreenEditorProps) {
  const { toast } = useToast();
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set(screen.tabs.map(t => t.id)));
  const [showAddFieldDialog, setShowAddFieldDialog] = useState<string | null>(null);
  const [showAddTabDialog, setShowAddTabDialog] = useState(false);

  const [updateScreen] = useUpdateScreenMutation();
  const [addTab, { isLoading: isAddingTab }] = useAddScreenTabMutation();
  const [deleteTab] = useDeleteScreenTabMutation();
  const [addField, { isLoading: isAddingField }] = useAddFieldToTabMutation();
  const [removeField] = useRemoveFieldFromTabMutation();

  const toggleTab = (tabId: string) => {
    const newExpanded = new Set(expandedTabs);
    if (newExpanded.has(tabId)) {
      newExpanded.delete(tabId);
    } else {
      newExpanded.add(tabId);
    }
    setExpandedTabs(newExpanded);
  };

  const handleAddTab = async (name: string) => {
    try {
      await addTab({ screenId: screen.id, data: { name } }).unwrap();
      toast({ title: 'Tab added successfully' });
      setShowAddTabDialog(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to add tab', variant: 'destructive' });
    }
  };

  const handleDeleteTab = async (tabId: string) => {
    try {
      await deleteTab(tabId).unwrap();
      toast({ title: 'Tab deleted successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete tab', variant: 'destructive' });
    }
  };

  const handleAddField = async (tabId: string, fieldId: string) => {
    try {
      await addField({
        tabId,
        data: { fieldId, fieldType: 'system', isRequired: false },
      }).unwrap();
      toast({ title: 'Field added successfully' });
      setShowAddFieldDialog(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to add field', variant: 'destructive' });
    }
  };

  const handleRemoveField = async (fieldId: string) => {
    try {
      await removeField(fieldId).unwrap();
      toast({ title: 'Field removed successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove field', variant: 'destructive' });
    }
  };

  const existingFieldIds = new Set(
    screen.tabs.flatMap(tab => tab.fields.map(f => f.fieldId))
  );

  const availableFields = systemFields.filter(f => !existingFieldIds.has(f.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {screen.name}
              {screen.isSystem && <Badge variant="secondary">System</Badge>}
            </CardTitle>
            <CardDescription>{screen.description || 'No description'}</CardDescription>
          </div>
          {!screen.isSystem && canUpdateProject && (
            <Button variant="outline" size="sm" onClick={() => setShowAddTabDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Tab
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {screen.tabs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No tabs yet. Add a tab to start configuring fields.
          </p>
        ) : (
          screen.tabs.map((tab) => (
            <Collapsible
              key={tab.id}
              open={expandedTabs.has(tab.id)}
              onOpenChange={() => toggleTab(tab.id)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-t-lg">
                    <div className="flex items-center gap-2">
                      {expandedTabs.has(tab.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{tab.name}</span>
                      <Badge variant="outline">{tab.fields.length} fields</Badge>
                    </div>
                    {!screen.isSystem && canUpdateProject && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAddFieldDialog(tab.id);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTab(tab.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t p-3 space-y-1">
                    {tab.fields.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No fields in this tab
                      </p>
                    ) : (
                      tab.fields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <span>{field.fieldLabel || field.fieldId}</span>
                            {field.isRequired && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                          </div>
                          {!screen.isSystem && canUpdateProject && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRemoveField(field.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))
        )}

        {/* Add Field Dialog */}
        <Dialog open={!!showAddFieldDialog} onOpenChange={(open) => !open && setShowAddFieldDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Field</DialogTitle>
              <DialogDescription>Select a field to add to this tab</DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {availableFields.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  All available fields are already added
                </p>
              ) : (
                availableFields.map((field) => (
                  <button
                    key={field.id}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted"
                    onClick={() => handleAddField(showAddFieldDialog!, field.id)}
                    disabled={isAddingField}
                  >
                    <span>{field.label}</span>
                    <Badge variant="outline">{field.type}</Badge>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Tab Dialog */}
        {canUpdateProject && (
          <AddTabDialog
            open={showAddTabDialog}
            onOpenChange={setShowAddTabDialog}
            onSubmit={handleAddTab}
            isLoading={isAddingTab}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface CreateScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  isLoading: boolean;
}

function CreateScreenDialog({ open, onOpenChange, onSubmit, isLoading }: CreateScreenDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description: description || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Screen</DialogTitle>
          <DialogDescription>Create a new screen to configure issue forms</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Screen"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this screen is for..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating...' : 'Create Screen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AddTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isLoading: boolean;
}

function AddTabDialog({ open, onOpenChange, onSubmit, isLoading }: AddTabDialogProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name);
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tab</DialogTitle>
          <DialogDescription>Add a new tab to organize fields</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tabName">Tab Name</Label>
            <Input
              id="tabName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Details"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Adding...' : 'Add Tab'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ScreensPage;
