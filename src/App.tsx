"use client";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Plus } from "lucide-react";
import { createClient, User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { faker } from "@faker-js/faker";
import { Toaster, toast } from "sonner";
import { useLocalStorage } from "@uidotdev/usehooks";

type Project = {
  id: string;
  name: string;
  url: string;
  publicKey: string;
};

type SectionId = "settings" | "auth" | "data-api" | "realtime" | "storage";

const SECTIONS: { id: SectionId; label: string; requiresSettings?: boolean }[] = [
  { id: "settings", label: "Settings" },
  { id: "auth", label: "Auth", requiresSettings: true },
  { id: "data-api", label: "Data API", requiresSettings: true },
  { id: "realtime", label: "Realtime", requiresSettings: true },
  { id: "storage", label: "Storage", requiresSettings: true },
];

const generateProjectId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export default function App() {
  const [projects, setProjects] = useLocalStorage<Project[]>("projects", []);
  const [activeProjectId, setActiveProjectId] = useLocalStorage<
    string | null
  >("active-project-id", null);
  const [activeSection, setActiveSection] = useLocalStorage<SectionId>(
    "active-section",
    "settings"
  );

  useEffect(() => {
    if (!projects.length) {
      const id = generateProjectId();
      setProjects([
        {
          id,
          name: "Project 1",
          url: "",
          publicKey: "",
        },
      ]);
      setActiveProjectId(id);
      return;
    }

    if (!activeProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProjectId, projects, setActiveProjectId, setProjects]);

  useEffect(() => {
    if (!SECTIONS.some((section) => section.id === activeSection)) {
      setActiveSection("settings");
    }
  }, [activeSection, setActiveSection]);

  const activeProject = useMemo(() => {
    if (!projects.length) {
      return null;
    }
    return (
      projects.find((project) => project.id === activeProjectId) ?? projects[0]
    );
  }, [activeProjectId, projects]);

  const settings = activeProject ?? {
    id: "",
    name: "",
    url: "",
    publicKey: "",
  };

  const hasSettings = Boolean(settings.url && settings.publicKey);

  const updateActiveProject = (values: Partial<Project>) => {
    setProjects((prev) => {
      if (!prev.length) {
        return prev;
      }
      const targetId = activeProject?.id ?? prev[0].id;
      return prev.map((project) =>
        project.id === targetId ? { ...project, ...values } : project
      );
    });
  };

  const createProject = () => {
    const id = generateProjectId();
    setProjects((prev) => {
      const project: Project = {
        id,
        name: `Project ${prev.length + 1}`,
        url: "",
        publicKey: "",
      };
      return [...prev, project];
    });
    setActiveProjectId(id);
    toast.success("Project created");
  };

  const deleteActiveProject = () => {
    if (!activeProject) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete project "${activeProject.name || "Unnamed project"}"?`
    );

    if (!shouldDelete) {
      return;
    }

    setProjects((prev) => {
      const updated = prev.filter((project) => project.id !== activeProject.id);
      if (!updated.length) {
        setActiveProjectId(null);
      } else if (activeProject.id === activeProjectId) {
        setActiveProjectId(updated[0].id);
      }
      return updated;
    });

    toast.success("Project deleted");
  };

  const handleSelectProject = (id: string) => {
    if (id === activeProject?.id) {
      return;
    }
    setActiveProjectId(id);
    toast.success("Project selected");
  };

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
    if (!hasSettings || !isPolling) {
      return;
    }

    const interval = setInterval(async () => {
      const res = await fetch(settings.url + "/rest/v1" + pollingEndpoint, {
        headers: {
          apikey: settings.publicKey,
        },
      });
      toast.info("GET: " + pollingEndpoint + " " + res.status);
    }, pollingInterval);
    return () => clearInterval(interval);
  }, [hasSettings, isPolling, pollingEndpoint, pollingInterval, settings.publicKey, settings.url]);

  const [users, setUsers] = useLocalStorage<User[]>("users", []);

  useEffect(() => {
    if (!hasSettings) {
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      const res = await supaClient()
        .auth.admin.listUsers()
        .then((res) => res.data);
      setUsers(res?.users);
    };
    fetchUsers();
  }, [hasSettings, settings.publicKey, settings.url, setUsers]);

  const [files, setFiles] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (!hasSettings) {
      setCurrentUser(null);
    }
  }, [hasSettings]);

  useEffect(() => {
    if (!hasSettings) {
      return;
    }

    supaClient()
      .auth.getUser()
      .then(({ data, error }) => {
        if (error) {
          toast.error("Error getting user: " + error.message);
          return;
        }
        setCurrentUser(data.user);
        toast.success("Signed in as " + data.user?.email);
      });
  }, [hasSettings, settings.publicKey, settings.url]);

  useEffect(() => {
    if (!hasSettings) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const provider = urlParams.get("provider");

    if (code && provider === "github") {
      supaClient()
        .auth.signInWithIdToken({
          provider,
          token: code,
        })
        .then(({ data, error }) => {
          if (error) {
            toast.error("Error signing in with " + provider);
          }
          setCurrentUser(data.user);
          toast.success("Signed in as " + data.user?.email);
        });
    }
  }, [hasSettings, settings.publicKey, settings.url]);

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
    if (!hasSettings) {
      return;
    }

    const fetchCurrentUser = async () => {
      const res = await supaClient().auth.getUser();
      setCurrentUser(res.data.user);
    };
    fetchCurrentUser();
  }, [hasSettings, settings.publicKey, settings.url]);

  async function loadFiles(bucket: string) {
    const client = createClient(settings.url, settings.publicKey);
    const res = await client.storage.from(bucket).list();
    if (res.data) {
      setFiles(res.data.map((file) => file.name));
      toast.success(`Loaded ${res.data.length} files`);
    }
  }

  const renderUnavailable = (message: string) => (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "settings":
        return (
          <section className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Settings</h2>
                <span className="text-sm">{hasSettings ? "✅" : "❌"}</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  const formData = new FormData(e.currentTarget);
                  const url = formData.get("url");
                  const publicKey = formData.get("publicKey");
                  const name = formData.get("name");

                  if (
                    typeof url !== "string" ||
                    typeof publicKey !== "string" ||
                    typeof name !== "string"
                  ) {
                    return;
                  }

                  updateActiveProject({
                    url,
                    publicKey,
                    name,
                  });

                  toast.success("Settings saved");
                }}
                className="mt-6"
              >
                <Label>Project name</Label>
                <Input name="name" defaultValue={settings.name} />
                <Label>API URL</Label>
                <Input name="url" defaultValue={settings?.url} />
                <Label>Service Role Key</Label>
                <Input name="publicKey" defaultValue={settings.publicKey} />
                <div className="actions">
                  <a
                    target="_blank"
                    href="https://supabase.com/dashboard/project/_/settings/api"
                  >
                    Get Service Role Key
                  </a>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                onClick={deleteActiveProject}
                disabled={!activeProject}
              >
                Delete project
              </Button>
            </div>
          </section>
        );
      case "auth":
        if (!hasSettings) {
          return renderUnavailable(
            "Add your Supabase settings to use the auth tools."
          );
        }

        return (
          <div className="space-y-6">
            <section className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Create user</h2>
              <form
                className="mt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const emailConfirm = formData.get("email-confirm") as string;
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
                <Label className="flex items-center gap-2">
                  Email
                  <button
                    className="text-xs text-gray-500 underline"
                    type="button"
                    onClick={() => setEmail(faker.internet.exampleEmail())}
                  >
                    Random
                  </button>
                </Label>
                <Label className="flex items-center gap-2">
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
                    <span className="text-zinc-500 select-none">Password</span>
                    <span className="font-medium select-all">TestPassword1</span>
                  </small>
                  <Button
                    type="button"
                    onClick={() => {
                      setEmail(faker.internet.exampleEmail());
                    }}
                  >
                    Random + Create
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </section>

            <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Auth</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage the current session and existing users.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleOAuthSignIn("github")}
                  >
                    Sign in with GitHub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      supaClient().auth.signOut().then(() => {
                        setCurrentUser(null);
                        toast.success("Signed out");
                      });
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
              <div>
                <Label>Current user</Label>
                <pre className="max-h-[200px] overflow-y-auto bg-zinc-100 rounded-md p-2 text-xs">
                  {JSON.stringify(currentUser || {}, null, 2)}
                </pre>
              </div>
              {currentUser && currentUser.email && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { error } = await supaClient().auth.resetPasswordForEmail(
                        currentUser.email!
                      );
                      if (error) throw error;
                      toast.success(
                        "Reset password email sent to " + currentUser.email
                      );
                    } catch (error) {
                      console.log(error);
                      toast.error("Error sending reset password email");
                    }
                  }}
                >
                  Send reset password email
                </Button>
              )}
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex flex-wrap items-center gap-2">
                    <span>{user.confirmed_at ? "✅" : "❌"}</span>
                    <span className="font-medium">{user.email}</span>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const res = await supaClient().auth.signInWithPassword({
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
            </section>
          </div>
        );
      case "data-api":
        if (!hasSettings) {
          return renderUnavailable(
            "Add your Supabase settings to try the data API tools."
          );
        }

        return (
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Data API</h2>
            <div className="mt-4 space-y-2">
              <Label>Interval (ms)</Label>
              <Input
                value={pollingInterval}
                onChange={(e) => setPollingInterval(Number(e.target.value))}
              />
              <Label>Endpoint</Label>
              <Input
                value={pollingEndpoint}
                onChange={(e) => setPollingEndpoint(e.target.value)}
              />
              <div className="actions">
                <a target="_blank" href="https://supabase.com/dashboard/project/_/api">
                  View Endpoints
                </a>
                <Button onClick={() => setIsPolling(!isPolling)}>
                  {isPolling ? "Stop" : "Start"}
                </Button>
              </div>
            </div>
          </section>
        );
      case "realtime":
        if (!hasSettings) {
          return renderUnavailable(
            "Add your Supabase settings to use realtime tools."
          );
        }

        return (
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Realtime</h2>
            <form
              className="mt-4 space-y-2"
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
              <Input name="channel" placeholder="public:test" />
              <Label>Payload</Label>
              <Input
                name="payload"
                defaultValue='{ "message": "hello from supamocka" }'
              />
              <div className="flex justify-end mt-4">
                <Button type="submit">Send</Button>
              </div>
            </form>
          </section>
        );
      case "storage":
        if (!hasSettings) {
          return renderUnavailable(
            "Add your Supabase settings to use storage tools."
          );
        }

        return (
          <div className="space-y-6">
            <section className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Upload files</h2>
              <form
                className="mt-4 space-y-2"
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
                <Button
                  className="mt-2"
                  type="button"
                  variant="outline"
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
                      error: (error) => "Error creating bucket: " + error.message,
                    });
                  }}
                >
                  Create bucket
                </Button>
                <Label>File name</Label>
                <Input
                  name="fileName"
                  placeholder="Leave empty for random"
                />
                <Label>File</Label>
                <Input name="file" type="file" />
                <div className="flex justify-end mt-4">
                  <Button type="submit">Upload</Button>
                </div>
              </form>
            </section>

            <section className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">List files</h2>
              <div className="mt-4 max-h-[200px] overflow-y-auto border rounded-md">
                {files.map((file) => (
                  <div
                    key={file}
                    className="min-h-[30px] border-b p-2 hover:bg-zinc-100"
                  >
                    {file}
                  </div>
                ))}
              </div>
              <form
                className="mt-4 space-y-2"
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
                  <Button type="submit">Load files</Button>
                </div>
              </form>
            </section>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" />
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="w-full border-b bg-muted/40 p-6 md:w-72 md:border-b-0 md:border-r">
          <div className="space-y-6">
            <div>
              <Label htmlFor="project-select" className="text-xs uppercase text-muted-foreground">
                Active project
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <select
                  id="project-select"
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                  value={settings.id}
                  onChange={(event) => handleSelectProject(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name || "Unnamed project"}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={createProject}
                  aria-label="Create project"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Create project</span>
                </Button>
              </div>
            </div>

            <nav className="space-y-1">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                const disabled = section.requiresSettings && !hasSettings;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    disabled={disabled}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow"
                        : "hover:bg-muted"
                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <header className="space-y-2 border-b pb-4">
            <h1 className="text-2xl font-semibold">supamocka</h1>
            <p className="text-sm text-muted-foreground">
              This is a tool to mock usage for a Supabase project and test different features. The API key will be stored
              in your browser's local storage.
              <strong className="ml-1">Do not use for real or production projects.</strong>
            </p>
          </header>
          <div className="mt-6 space-y-6">{renderSection()}</div>
          <footer className="mt-10 text-sm text-muted-foreground">
            <a target="_blank" href="https://github.com/jordienr/supamocka" rel="noreferrer">
              GitHub
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
