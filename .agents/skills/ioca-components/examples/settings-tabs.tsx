/**
 * Settings Page with Tabs
 *
 * Demonstrates: Tabs + Tabs.Item + Select + Input.Textarea + Button
 * Flow: Organize settings into tab groups
 */

import { Tabs, Select, Input, Button, Message } from "@ioca/react";

export default function SettingsTabs() {
  const handleSave = () => {
    Message.success("Settings saved");
  };

  return (
    <Tabs type="line">
      <Tabs.Item key="general" title="General">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
          <Select
            label="Language"
            options={[
              { value: "zh", label: "中文" },
              { value: "en", label: "English" },
            ]}
          />
          <Select
            label="Theme"
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
      </Tabs.Item>
      <Tabs.Item key="profile" title="Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
          <Input label="Nickname" placeholder="Enter nickname" />
          <Input.Textarea label="Bio" placeholder="Enter bio" />
        </div>
      </Tabs.Item>
      <Tabs.Item key="actions" title="Actions">
        <div style={{ display: "flex", gap: 12, padding: 16 }}>
          <Button type="primary" onClick={handleSave}>Save Settings</Button>
          <Button>Reset</Button>
        </div>
      </Tabs.Item>
    </Tabs>
  );
}
