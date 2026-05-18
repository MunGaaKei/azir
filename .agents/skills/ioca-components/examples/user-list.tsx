/**
 * User List (Datagrid)
 *
 * Demonstrates: Datagrid + Badge + Tag
 * Flow: Display user data in a table with custom column rendering
 */

import { Datagrid, Badge, Tag } from "@ioca/react";
import type { IColumn } from "@ioca/react/components/datagrid/type";

interface User {
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "disabled";
}

const columns: IColumn[] = [
  { id: "name", title: "Name" },
  { id: "email", title: "Email" },
  {
    id: "role",
    title: "Role",
    render: (value: string) => (
      <Tag>{value === "admin" ? "Admin" : "User"}</Tag>
    ),
  },
  {
    id: "status",
    title: "Status",
    render: (value: string) => (
      <Badge type={value === "active" ? "success" : "default"}>
        {value === "active" ? "Active" : "Disabled"}
      </Badge>
    ),
  },
];

const data: User[] = [
  { name: "Zhang San", email: "zhangsan@example.com", role: "admin", status: "active" },
  { name: "Li Si", email: "lisi@example.com", role: "user", status: "active" },
  { name: "Wang Wu", email: "wangwu@example.com", role: "user", status: "disabled" },
];

export default function UserList() {
  return (
    <Datagrid
      data={data}
      columns={columns}
      striped
      border
      rowKey="email"
    />
  );
}
