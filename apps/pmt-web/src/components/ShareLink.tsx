import { useState } from 'react';
import { Button, Popover, Input, Typography, message, Alert } from 'antd';
import { Share2, Copy } from 'lucide-react';
import { ENV } from '../lib/env';

const { Text, Paragraph } = Typography;

/**
 * Top-bar "Share" button. Shows the live app link (the URL you're currently on)
 * so an admin can copy it and send it to the team, with instructions below.
 */
export default function ShareLink() {
  const [open, setOpen] = useState(false);
  // Prefer the host's LAN IP (injected by the installer) so the link is one the
  // team can actually open, even when the admin is browsing via localhost.
  const port = window.location.port;
  const link = ENV.PUBLIC_HOST
    ? `http://${ENV.PUBLIC_HOST}${port ? ':' + port : ''}`
    : window.location.origin;
  const isLocalhost = !ENV.PUBLIC_HOST && /^(localhost|127\.0\.0\.1|\[::1\])/i.test(window.location.hostname);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      message.success('Link copied — send it to your team');
    } catch {
      message.warning('Could not copy automatically — select and copy the link');
    }
  };

  const content = (
    <div style={{ width: 320 }}>
      <Text strong>Share with your team</Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Input readOnly value={link} onFocus={(e) => e.target.select()} />
        <Button type="primary" icon={<Copy size={15} />} onClick={copy}>Copy</Button>
      </div>

      {isLocalhost && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 10 }}
          message="This is a localhost link"
          description="Others can't open localhost. Open this app using this PC's network address (e.g. http://192.168.x.x:3001) and share that instead."
        />
      )}

      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        <strong>How your team uses it:</strong>
        <br />1. They must be on the <strong>same office Wi-Fi/network</strong> as this PC.
        <br />2. Open the link in a browser (Chrome/Edge).
        <br />3. Log in with the account you created for them.
        <br />4. Keep <strong>this PC switched on</strong> — it hosts the app.
      </Paragraph>
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight">
      <Button type="text" icon={<Share2 size={18} />} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13 }}>Share</span>
      </Button>
    </Popover>
  );
}
