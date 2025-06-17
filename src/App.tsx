"use client";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { createClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import { faker } from "@faker-js/faker";
import { Toaster, toast } from "sonner";
import { useLocalStorage } from "@uidotdev/usehooks";

export default function App() {
  const [accordions, setAccordions] = useLocalStorage("accordions", [
    "settings",
  ]);

  const [settings, setSettings] = useLocalStorage("api", {
    url: "",
    publicKey: "",
  });

  // $npx shadcn@latest add http://localhost:3004/ui/r/current-user-avatar-react.json

  const [email, setEmail] = useState("");

  function supaClient() {
    return createClient(settings.url, settings.publicKey);
  }

  function reqHandler({
    request,
    loadingMessage = "Loading...",
    successMessage = "Success",
    errorMessage = "Error",
  }: {
    request: Promise<unknown>;
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
  }) {
    toast.promise(request, {
      loading: loadingMessage,
      success: (data) => {
        console.log(data);
        return successMessage;
      },
      error: (error) => {
        console.log(error);
        return errorMessage + ". Check the console for more deets.";
      },
    });
  }

  const [pollingInterval, setPollingInterval] = useLocalStorage(
    "polling-interval",
    1000
  );
  const [pollingEndpoint, setPollingEndpoint] = useLocalStorage(
    "polling-endpoint",
    "/test"
  );
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (isPolling) {
      const interval = setInterval(async () => {
        const res = await fetch(settings?.url + "/rest/v1" + pollingEndpoint, {
          headers: {
            apikey: settings?.publicKey,
          },
        });
        toast.info("GET: " + pollingEndpoint + " " + res.status);
      }, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [isPolling, pollingInterval, pollingEndpoint, settings?.url]);

  const [users, setUsers] = useLocalStorage<User[]>("users", []);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await supaClient()
        .auth.admin.listUsers()
        .then((res) => res.data);
      setUsers(res?.users);
    };
    fetchUsers();
  }, [setUsers]);

  const hasSettings = settings.url && settings.publicKey;

  const [files, setFiles] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
      supaClient().auth.getUser().then(({ data, error }) => {
        if (error) {
          toast.error("Error getting user: " + error.message);
          return;
        }
        setCurrentUser(data.user);
        toast.success("Signed in as " + data.user?.email);
      });

  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const provider = urlParams.get('provider');

    if (code && provider) {
      supaClient().auth.signInWithIdToken({
        provider,
        token: code,
      }).then(({ data, error }) => {
        if (error) {
          toast.error("Error signing in with " + provider);
        }
        setCurrentUser(data.user);
        toast.success("Signed in as " + data.user?.email);
      });
    }
  }, []);

  async function handleOAuthSignIn(provider: 'github') {
    try {
      const { error } = await supaClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        toast.error("Error signing in with " + provider);
        throw error;
      }
      toast.success("Redirecting to " + provider);
    } catch (error) {
      console.log(error);
      toast.error("Error signing in with " + provider);
    }
  }

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const res = await supaClient().auth.getUser();
      setCurrentUser(res.data.user);
    };
    fetchCurrentUser();
  }, []);

  async function loadFiles(bucket: string) {
    const client = createClient(settings.url, settings.publicKey);
    const res = await client.storage.from(bucket).list();
    if (res.data) {
      setFiles(res.data.map((file) => file.name));
      toast.success(`Loaded ${res.data.length} files`);
    }
  }

  return (
    <div className="font-mono p-4 max-w-xl mx-auto">
      <Toaster position="top-right" />
      <h1 className="p-3 font-medium text-lg text-center">supamocka</h1>
      <p className="text-xs text-center text-gray-500 border rounded-md p-2">
        This is a tool to mock usage for a Supabase project and test different
        features. The API key will be stored in your browser's local storage. `
        <br />
        <b>Do not use for real or production projects.</b>
      </p>

      <div className="">
        <Accordion
          className="p-3"
          type="multiple"
          value={accordions}
          onValueChange={setAccordions}
        >
          <AccordionItem value="settings">
            <AccordionTrigger>
              Settings {hasSettings ? "✅" : "❌"}
            </AccordionTrigger>
            <AccordionContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  const formData = new FormData(e.currentTarget);
                  const url = formData.get("url") as string;
                  const publicKey = formData.get("publicKey") as string;

                  if (typeof url !== "string") {
                    return;
                  }

                  setSettings({
                    url,
                    publicKey,
                  });

                  toast.success("Settings saved");
                }}
                className="mt-2"
              >
                <Label>API URL</Label>
                <Input name="url" defaultValue={settings?.url} />
                <Label>Service Role Key</Label>
                <Input name="publicKey" defaultValue={settings.publicKey} />
                <div className="flex justify-end gap-4 items-center mt-4">
                  <a
                    target="_blank"
                    href="https://supabase.com/dashboard/project/_/settings/api"
                  >
                    Get Service Role Key
                  </a>
                  <Button>Save</Button>
                </div>
              </form>
            </AccordionContent>
          </AccordionItem>
          {hasSettings && (
            <>
              <AccordionItem value="create-user">
                <AccordionTrigger>Create user</AccordionTrigger>
                <AccordionContent>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const emailConfirm = formData.get(
                        "email-confirm"
                      ) as string;
                      const request = supaClient()
                        .auth.admin.createUser({
                          email,
                          password: "TestPassword1",
                          email_confirm: emailConfirm === "on",
                        })
                        .then((res) => {
                          if (res.error) {
                            throw res.error;
                          }
                          return res.data;
                        });
                      reqHandler({
                        request,
                        loadingMessage: "Creating user",
                        successMessage: "User created",
                        errorMessage: "Error creating user",
                      });
                    }}
                  >
                    <Label className="flex items-center">
                      Email{" "}
                      <button
                        className="text-xs text-gray-500 underline p-2"
                        type="button"
                        onClick={() => setEmail(faker.internet.exampleEmail())}
                      >
                        Random
                      </button>
                    </Label>
                    <Label>
                      <input
                        id="email-confirm"
                        name="email-confirm"
                        type="checkbox"
                        defaultChecked={true}
                      />
                      Confirm email
                    </Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="actions">
                      <small className="px-2 py-1 border bg-zinc-100 rounded-sm space-x-2">
                        <span className="text-zinc-500 select-none">
                          Password
                        </span>
                        <span className="font-medium select-all">
                          TestPassword1
                        </span>
                      </small>
                      <Button
                        onClick={() => {
                          setEmail(faker.internet.exampleEmail());
                        }}
                      >
                        Random + Create
                      </Button>
                      <Button>Create</Button>
                    </div>
                  </form>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="auth">
                <AccordionTrigger>Auth</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Current user</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleOAuthSignIn('github')}
                        >
                          Sign in with GitHub
                        </Button>
                        <button
                          onClick={() => {
                            supaClient().auth.signOut().then(() => {
                              setCurrentUser(null);
                              toast.success("Signed out");
                            });
                          }}
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                    <pre className="max-h-[200px] overflow-y-auto bg-zinc-100 rounded-md p-2">
                      {JSON.stringify(currentUser || {}, null, 2)}
                    </pre>
                    {currentUser && currentUser.email && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            const { error } = await supaClient().auth.resetPasswordForEmail(currentUser.email!);
                            if (error) throw error;
                            toast.success("Reset password email sent to " + currentUser.email);
                          } catch (error) {
                            console.log(error);
                            toast.error("Error sending reset password email");
                          }
                        }}
                      >
                        Send reset password email
                      </Button>
                    )}
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center gap-2">
                        <span>{user.confirmed_at ? "✅" : "❌"}</span>
                        <span>{user.email}</span>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              const res =
                                await supaClient().auth.signInWithPassword({
                                  email: user.email || "",
                                  password: "TestPassword1",
                                });
                              setCurrentUser(res.data?.user);
                              toast.success("Logged in as " + user.email);
                            } catch (error) {
                              console.log(error);
                              toast.error("Error logging in");
                            }
                          }}
                        >
                          Mock Login
                        </Button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="polling">
                <AccordionTrigger>Polling</AccordionTrigger>
                <AccordionContent>
                  <div className="">
                    <Label>Interval (ms)</Label>
                    <Input
                      value={pollingInterval}
                      onChange={(e) =>
                        setPollingInterval(Number(e.target.value))
                      }
                    />
                    <Label>Endpoint</Label>
                    <Input
                      value={pollingEndpoint}
                      onChange={(e) => setPollingEndpoint(e.target.value)}
                    />
                    <div className="actions">
                      <a
                        target="_blank"
                        href="https://supabase.com/dashboard/project/_/api"
                      >
                        View Endpoints
                      </a>
                      <Button onClick={() => setIsPolling(!isPolling)}>
                        {isPolling ? "Stop" : "Start"}
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="realtime">
                <AccordionTrigger>Realtime</AccordionTrigger>
                <AccordionContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const channel = formData.get("channel") as string;
                      const payload = formData.get("payload") as string;

                      supaClient()
                        .channel(channel)
                        .send({
                          type: "broadcast",
                          event: "test",
                          payload: JSON.parse(payload),
                        });

                      toast.success("Sent");
                    }}
                  >
                    <Label>Channel</Label>
                    <Input />
                    <Label>Payload</Label>
                    <Input />
                    <div className="flex justify-end mt-4">
                      <Button>Send</Button>
                    </div>
                  </form>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="storage-upload">
                <AccordionTrigger>Upload files</AccordionTrigger>
                <AccordionContent>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();

                      const formData = new FormData(e.currentTarget);
                      const file = formData.get("file") as File;
                      const bucket = formData.get("bucket") as string;
                      const fileName = formData.get("fileName") as string;

                      const randomFileName = faker.string.uuid();

                      const res = supaClient()
                        .storage.from(bucket)
                        .upload((fileName || file.name) + randomFileName, file)
                        .then((res) => {
                          if (res.error) {
                            throw res.error;
                          }
                          return res.data;
                        });

                      toast.promise(res, {
                        loading: "Uploading...",
                        success: "Uploaded",
                        error: (error) => "Error uploading: " + error.message,
                      });
                    }}
                  >
                    <Label>Bucket</Label>
                    <Input name="bucket" defaultValue="test" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const res = supaClient()
                          .storage.createBucket("test")
                          .then((res) => {
                            if (res.error) {
                              throw res.error;
                            }
                            return res.data;
                          });

                        toast.promise(res, {
                          loading: "Creating bucket",
                          success: "Bucket created",
                          error: (error) =>
                            "Error creating bucket: " + error.message,
                        });
                      }}
                    >
                      Create bucket
                    </button>
                    <Label>File name</Label>
                    <Input
                      name="fileName"
                      placeholder="Leave empty for random"
                    />
                    <Label>File</Label>
                    <Input name="file" type="file" />
                    <div className="flex justify-end mt-4">
                      <Button>Upload</Button>
                    </div>
                  </form>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="storage-list">
                <AccordionTrigger>List files</AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-[200px] overflow-y-auto border rounded-md">
                    {files.map((file) => (
                      <div
                        key={file}
                        className="p-2 border-b hover:bg-zinc-100 min-h-[30px]"
                      >
                        {file}
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const bucket = formData.get("bucket") as string;
                      loadFiles(bucket);
                    }}
                  >
                    <Label>Bucket</Label>
                    <Input name="bucket" defaultValue="test" />
                    <div className="flex justify-end mt-4">
                      <Button>Load files</Button>
                    </div>
                  </form>
                </AccordionContent>
              </AccordionItem>
            </>
          )}
        </Accordion>
      </div>
      <footer className="text-xs text-center text-gray-500 mt-4">
        <a target="_blank" href="https://github.com/jordienr/supamocka">
          GitHub
        </a>
      </footer>
    </div>
  );
}
