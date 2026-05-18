/**
 * Login Modal
 *
 * Demonstrates: Modal + Input + Button + Message
 * Flow: Click login button → modal opens → fill credentials → validate → success toast
 */

import { useState } from "react";
import { Modal, Input, Button, Message } from "@ioca/react";

export default function LoginModal() {
  const [visible, setVisible] = useState(false);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (!account || !password) {
      Message.warning("Please enter account and password");
      return;
    }
    Message.success("Login successful");
    setVisible(false);
  };

  return (
    <>
      <Button type="primary" onClick={() => setVisible(true)}>
        Login
      </Button>
      <Modal
        visible={visible}
        header="Login"
        onVisibleChange={setVisible}
        onOk={handleLogin}
      >
        <Input
          label="Account"
          placeholder="Enter account"
          value={account}
          onChange={setAccount}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={setPassword}
        />
      </Modal>
    </>
  );
}
