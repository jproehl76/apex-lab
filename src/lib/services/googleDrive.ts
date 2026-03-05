export interface DrivePickerSelection {
  fileId: string;
  filename: string;
}

interface PickerResult {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string }>;
}

function injectGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.gapi !== 'undefined') {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(script);
  });
}

function loadPickerLib(): Promise<void> {
  return new Promise((resolve) => {
    window.gapi.load('picker', () => resolve());
  });
}

export async function openDrivePicker(accessToken: string): Promise<DrivePickerSelection | null> {
  await injectGapiScript();
  await loadPickerLib();

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView()
      .setMimeTypes('application/json,text/plain,text/json,application/octet-stream,text/csv,application/csv')
      .setParent('1BrltfQ6HfS5O5Rkb0xU767zSpuCtLsGM')
      .setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setTitle('Select session JSON file')
      .setCallback((data: PickerResult) => {
        if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
          resolve({ fileId: data.docs[0].id, filename: data.docs[0].name });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
        // Ignore other actions (e.g. 'loaded') — wait for PICKED or CANCEL
      })
      .build();

    picker.setVisible(true);
  });
}

export async function fetchDriveFileContent(
  fileId: string,
  accessToken: string
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Drive API error: ${response.statusText}`);
  }
  return response.text();
}
