import { useOutletContext } from 'react-router-dom';
import ImportCapture from '../components/ImportCapture';

export default function CapturePage() {
  const { lptiyuConfig, setLptiyuConfig } = useOutletContext();

  return (
    <ImportCapture
      savedConfig={lptiyuConfig}
      onClearConfig={() => setLptiyuConfig(null)}
      onSaveConfig={(cfg) => setLptiyuConfig(cfg)}
    />
  );
}
