export {};

declare global {
  interface Window {
    gapi: Gapi;
    google: Google;
  }
}

interface Gapi {
  load: (lib: string, callback: () => void) => void;
  auth: {
    getToken: () => { access_token: string } | null;
  };
}

interface Google {
  picker: GooglePicker;
}

interface GooglePicker {
  PickerBuilder: new () => GooglePickerBuilder;
  Action: { PICKED: string; CANCEL: string };
  ViewId: { DOCS: string };
  Feature: { NAV_HIDDEN: string; MULTISELECT_ENABLED: string };
  DocsView: new (viewId?: string) => GoogleDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => this;
  setOAuthToken: (token: string) => this;
  setCallback: (cb: (data: GooglePickerResult) => void) => this;
  enableFeature: (feature: string) => this;
  setTitle: (title: string) => this;
  build: () => { setVisible: (v: boolean) => void };
}

interface GoogleDocsView {
  setMimeTypes: (mimes: string) => this;
  setParent: (folderId: string) => this;
  setIncludeFolders: (include: boolean) => this;
}

interface GooglePickerResult {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string }>;
}
