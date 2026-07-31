import { LockOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import App from "./App";
import { acceptAuthInvitation, getAuthMe, login, type AuthUser } from "./api/client";

const { Title, Text } = Typography;

export default function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getAuthMe().then((current) => {
      setUser(current);
      window.localStorage.setItem("family-life.current-user", JSON.stringify(current));
    }).catch(() => undefined).finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="auth-loading"><Spin size="large" /></div>;
  if (user) return <App />;
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <img className="auth-logo" src="/oreo-icon.png" alt="奥利奥" />
        <Title level={2}>家庭生活</Title>
        <Text type="secondary">登录后继续管理财务、健康与日程</Text>
        {error ? <Alert type="error" showIcon title={error} /> : null}
        <Form
          layout="vertical"
          onFinish={async (values) => {
            setError(undefined);
            try {
              const current = values.invitationCode
                ? await acceptAuthInvitation(values)
                : await login(values);
              window.localStorage.setItem("family-life.current-user", JSON.stringify(current));
              setUser(current);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "登录失败");
            }
          }}
        >
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="invitationCode" label="邀请码（仅首次加入家庭时填写）">
            <Input autoComplete="off" />
          </Form.Item>
          <Button htmlType="submit" type="primary" block>登录</Button>
        </Form>
      </Card>
    </main>
  );
}
