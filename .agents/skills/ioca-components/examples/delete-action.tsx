/**
 * Delete Confirmation
 *
 * Demonstrates: Popconfirm + Button + Message
 * Flow: Click delete → confirmation popup → confirm → API call → success toast
 */

import { Button, Popconfirm, Message } from "@ioca/react";

interface DeleteActionProps {
  id: string;
  onSuccess?: () => void;
}

export default function DeleteAction({ id, onSuccess }: DeleteActionProps) {
  const handleOk = async () => {
    await fetch(`/api/delete/${id}`, { method: "DELETE" });
    Message.success("Deleted successfully");
    onSuccess?.();
  };

  return (
    <Popconfirm
      content="Are you sure you want to delete? This action cannot be undone."
      onOk={handleOk}
    >
      <Button type="error" size="small">Delete</Button>
    </Popconfirm>
  );
}
