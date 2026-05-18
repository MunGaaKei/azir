/**
 * User Form
 *
 * Demonstrates: Form + Form.Field + Input + Select + Button + Message
 * Flow: Collect name and role, show success toast on submit
 */

import { Form, Input, Select, Button, Message } from "@ioca/react";

interface UserFormProps {
  initialValues?: Record<string, any>;
}

export default function UserForm({ initialValues }: UserFormProps) {
  const form = Form.useForm();

  const handleSubmit = () => {
    Message.success(`Submitted: ${JSON.stringify(form.data)}`);
  };

  return (
    <Form
      form={form}
      columns={1}
      labelWidth="4em"
      initialValues={initialValues}
      onEnter={handleSubmit}
    >
      <Form.Field name="name">
        <Input label="Name" placeholder="Enter name" required />
      </Form.Field>
      <Form.Field name="role">
        <Select
          label="Role"
          options={[
            { value: "admin", label: "Admin" },
            { value: "user", label: "User" },
            { value: "guest", label: "Guest" },
          ]}
        />
      </Form.Field>
      <Button type="primary" onClick={handleSubmit}>Submit</Button>
    </Form>
  );
}
