import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import {
  useGetLinkTypesQuery,
  useCreateLinkTypeMutation,
  useUpdateLinkTypeMutation,
  useDeleteLinkTypeMutation,
  type LinkType,
} from '../../features/issues/issuesApi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';

const EMPTY_FORM = {
  name: '',
  outward: '',
  inward: '',
  description: '',
};

export function LinkTypesPage() {
  const { hasPermission: canManageLinkTypes } = usePermissionGuard('admin.settings');
  const { data: linkTypes = [], isLoading } = useGetLinkTypesQuery();
  const [createLinkType, { isLoading: isCreating }] = useCreateLinkTypeMutation();
  const [updateLinkType, { isLoading: isUpdating }] = useUpdateLinkTypeMutation();
  const [deleteLinkType, { isLoading: isDeleting }] = useDeleteLinkTypeMutation();

  const [formState, setFormState] = useState(EMPTY_FORM);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType | null>(null);

  const openCreateDialog = () => {
    setFormState(EMPTY_FORM);
    setIsCreateOpen(true);
  };

  const openEditDialog = (linkType: LinkType) => {
    setSelectedLinkType(linkType);
    setFormState({
      name: linkType.name || '',
      outward: linkType.outward || '',
      inward: linkType.inward || '',
      description: linkType.description || '',
    });
    setIsEditOpen(true);
  };

  const handleCreate = async () => {
    const name = (formState.name || '').trim();
    const outward = (formState.outward || '').trim();
    const inward = (formState.inward || '').trim();
    const description = (formState.description || '').trim();

    if (!name || !outward || !inward) return;

    await createLinkType({
      name,
      outward,
      inward,
      description: description || null,
    }).unwrap();
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!selectedLinkType) return;
    const name = (formState.name || '').trim();
    const outward = (formState.outward || '').trim();
    const inward = (formState.inward || '').trim();
    const description = (formState.description || '').trim();

    await updateLinkType({
      linkTypeId: selectedLinkType.id,
      data: {
        name,
        outward,
        inward,
        description: description || null,
      },
    }).unwrap();
    setIsEditOpen(false);
    setSelectedLinkType(null);
  };

  const handleDelete = async (linkTypeId: string) => {
    await deleteLinkType(linkTypeId).unwrap();
  };

  const isFormValid =
    !!(formState.name || '').trim() &&
    !!(formState.outward || '').trim() &&
    !!(formState.inward || '').trim();

  if (!canManageLinkTypes) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-2xl font-bold">Link Types</h1>
              <p className="text-sm text-muted-foreground">
                Configure issue link relationships used across projects
              </p>
            </div>
            <Button onClick={openCreateDialog}>Add Link Type</Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          {isLoading ? (
            <div className="text-muted-foreground">Loading link types...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Outward</TableHead>
                    <TableHead>Inward</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No link types configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    linkTypes.map((linkType) => (
                      <TableRow key={linkType.id}>
                        <TableCell className="font-medium">{linkType.name}</TableCell>
                        <TableCell>{linkType.outward}</TableCell>
                        <TableCell>{linkType.inward}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {linkType.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(linkType)}
                            >
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isDeleting}>
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete link type</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the link type. Existing issue links must be removed first.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(linkType.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </main>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Link Type</DialogTitle>
              <DialogDescription>
                Define how issues relate to each other across projects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="blocks"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Outward text</label>
                <Input
                  value={formState.outward}
                  onChange={(e) => setFormState((prev) => ({ ...prev, outward: e.target.value }))}
                  placeholder="blocks"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Inward text</label>
                <Input
                  value={formState.inward}
                  onChange={(e) => setFormState((prev) => ({ ...prev, inward: e.target.value }))}
                  placeholder="is blocked by"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!isFormValid || isCreating}>
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Link Type</DialogTitle>
              <DialogDescription>
                Update the wording for how issues relate to each other.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Outward text</label>
                <Input
                  value={formState.outward}
                  onChange={(e) => setFormState((prev) => ({ ...prev, outward: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Inward text</label>
                <Input
                  value={formState.inward}
                  onChange={(e) => setFormState((prev) => ({ ...prev, inward: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={!isFormValid || isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}

export default LinkTypesPage;
