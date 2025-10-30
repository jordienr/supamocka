"use client";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { createClient, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    return window.location.pathname || "/";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      setCurrentPath(window.location.pathname || "/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname === path) {
      return;
    }

    window.history.pushState({}, "", path);
    setCurrentPath(path);
  }, []);

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

  const updateProjectById = (projectId: string, values: Partial<Project>) => {
    if (!projectId) {
      return;
    }

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, ...values } : project
      )
    );
  };

  const updateActiveProject = (values: Partial<Project>) => {
    if (!projects.length) {
      return;
    }

    const targetId = activeProject?.id ?? projects[0].id;
    updateProjectById(targetId, values);
  };

  const createProject = () => {
    if (currentUser) {
      handleSelectUser("");
    }
    const id = generateProjectId();
    let project: Project | null = null;
    setProjects((prev) => {
      project = {
        id,
        name: `Project ${prev.length + 1}`,
        url: "",
        publicKey: "",
      };
      return [...prev, project];
    });
    setActiveProjectId(id);
    toast.success("Project created");
    return project!;
  };

  const deleteProjectById = (projectId: string) => {
    if (!projectId) {
      return;
    }

    if (currentUser) {
      handleSelectUser("");
    }

    setProjects((prev) => {
      const updated = prev.filter((project) => project.id !== projectId);
      if (!updated.length) {
        setActiveProjectId(null);
      } else if (projectId === activeProjectId) {
        setActiveProjectId(updated[0].id);
      }
      return updated;
    });

    toast.success("Project deleted");
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

    deleteProjectById(activeProject.id);
  };

  const handleSelectProject = (id: string) => {
    if (id === activeProject?.id) {
      return;
    }

    if (currentUser) {
      handleSelectUser("");
    }
    setActiveProjectId(id);
    toast.success("Project selected");
  };

  // $npx shadcn@latest add http://localhost:3004/ui/r/current-user-avatar-react.json

  const [email, setEmail] = useState("");
  const [shouldConfirmEmail, setShouldConfirmEmail] = useState(true);

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
  const [selectedUserId, setSelectedUserId] = useState<string>("");

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
    setUsers([]);
    fetchUsers();
  }, [hasSettings, settings.publicKey, settings.url]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    setCurrentUser(null);
    setSelectedUserId("");
  }, [settings.id]);

  useEffect(() => {
    setSelectedUserId(currentUser?.id ?? "");
  }, [currentUser?.id]);

  const [files, setFiles] = useState<string[]>([]);

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
          console.error("Error getting user: " + error.message);
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

  const handleCreateUser = (emailAddress: string) => {
    const normalizedEmail = emailAddress.trim();
    if (!normalizedEmail) {
      toast.error("Enter an email before creating a user");
      return;
    }

    setEmail(normalizedEmail);

    const request = supaClient()
      .auth.admin.createUser({
        email: normalizedEmail,
        password: "TestPassword1",
        email_confirm: shouldConfirmEmail,
      })
      .then((res) => {
        if (res.error) {
          throw res.error;
        }
        return res.data;
      })
      .then(async (data) => {
        try {
          const response = await supaClient().auth.admin.listUsers();
          setUsers(response.data?.users ?? []);
        } catch (error) {
          console.log(error);
        }
        return data;
      });

    reqHandler({
      request,
      loadingMessage: "Creating user",
      successMessage: "User created",
      errorMessage: "Error creating user",
    });
  };

  const handleSelectUser = (userId: string) => {
    const previousUserId = currentUser?.id ?? "";

    if (userId === previousUserId) {
      return;
    }

    if (!userId) {
      setSelectedUserId("");
      const signOutPromise = supaClient()
        .auth.signOut()
        .then(({ error }) => {
          if (error) {
            throw error;
          }
          setCurrentUser(null);
          setSelectedUserId("");
        });

      signOutPromise.catch(() => {
        setSelectedUserId(previousUserId);
      });

      toast.promise(signOutPromise, {
        loading: "Signing out",
        success: "Signed out",
        error: () => "Error signing out",
      });

      return;
    }

    const user = users.find((item) => item.id === userId);

    if (!user || !user.email) {
      toast.error("Selected user is missing an email address");
      setSelectedUserId(previousUserId);
      return;
    }

    const signInPromise = supaClient()
      .auth.signInWithPassword({
        email: user.email,
        password: "TestPassword1",
      })
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        setCurrentUser(data.user);
        return data.user;
      });

    signInPromise.catch(() => {
      setSelectedUserId(previousUserId);
    });

    toast.promise(signInPromise, {
      loading: "Signing in",
      success: () => `Logged in as ${user.email}`,
      error: () => "Error logging in",
    });
  };

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
                key={settings.id || "no-project"}
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
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateUser(email);
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
                    checked={shouldConfirmEmail}
                    onChange={(event) => setShouldConfirmEmail(event.target.checked)}
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
                      const generatedEmail = faker.internet.exampleEmail();
                      setEmail(generatedEmail);
                      handleCreateUser(generatedEmail);
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
                      handleSelectUser("");
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
                      onClick={() => {
                        setSelectedUserId(user.id);
                        handleSelectUser(user.id);
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

  const isProjectsPage = currentPath === "/projects";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" />
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="w-full border-b bg-muted/40 p-6 md:w-72 md:border-b-0 md:border-r">
          <div className="space-y-6">
            <div>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isProjectsPage
                    ? "bg-primary text-primary-foreground shadow"
                    : "hover:bg-muted"
                }`}
                aria-current={isProjectsPage ? "page" : undefined}
              >
                Projects
              </button>
            </div>
            <div>
              <Label htmlFor="project-select" className="text-xs uppercase text-muted-foreground">
                Active project
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <select
                  id="project-select"
                  className="flex-1 min-w-0 truncate rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                  value={settings.id}
                  onChange={(event) => handleSelectProject(event.target.value)}
                  title={activeProject?.name || "Unnamed project"}
                >
                  {projects.map((project) => (
                    <option
                      key={project.id}
                      value={project.id}
                      title={project.name || "Unnamed project"}
                    >
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
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Create project</span>
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="user-select" className="text-xs uppercase text-muted-foreground">
                Active user
              </Label>
              <div className="mt-2">
                <select
                  id="user-select"
                  className="w-full truncate rounded-md border bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedUserId}
                  disabled={!hasSettings || !users.length}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedUserId(value);
                    handleSelectUser(value);
                  }}
                  title={
                    selectedUserId
                      ? users.find((user) => user.id === selectedUserId)?.email || "Unnamed user"
                      : "No active user"
                  }
                >
                  <option value="">No active user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id} title={user.email || "Unnamed user"}>
                      {user.email || "Unnamed user"}
                    </option>
                  ))}
                </select>
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
                    onClick={() => {
                      setActiveSection(section.id);
                      if (isProjectsPage) {
                        navigate("/");
                      }
                    }}
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
          <header className="border-b pb-4 flex items-center gap-4">
          <img src="/supamockalogo.png" alt="supamocka" className="w-20 h-20 rounded-full" />
          <div className="">
            <h1 className="text-2xl font-semibold">supamocka</h1>
            <p className="text-muted-foreground">
              A tool to mock usage for a Supabase projects. The API key will be stored
              in your browser's local storage.
            </p>
          </div>
          </header>
          <div className="mt-6 space-y-6">
            {isProjectsPage ? (
              <ProjectsPage
                projects={projects}
                activeProjectId={activeProject?.id ?? null}
                onCreateProject={createProject}
                onDeleteProject={deleteProjectById}
                onSelectProject={(projectId) => {
                  handleSelectProject(projectId);
                  navigate("/");
                }}
                onUpdateProject={updateProjectById}
              />
            ) : (
              renderSection()
            )}
          </div>
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

type ProjectsPageProps = {
  projects: Project[];
  activeProjectId: string | null;
  onCreateProject: () => Project;
  onDeleteProject: (projectId: string) => void;
  onSelectProject: (projectId: string) => void;
  onUpdateProject: (projectId: string, values: Partial<Project>) => void;
};

function ProjectsPage({
  projects,
  activeProjectId,
  onCreateProject,
  onDeleteProject,
  onSelectProject,
  onUpdateProject,
}: ProjectsPageProps) {
  const handleDelete = (project: Project) => {
    const shouldDelete = window.confirm(
      `Delete project "${project.name || "Unnamed project"}"?`
    );

    if (!shouldDelete) {
      return;
    }

    onDeleteProject(project.id);
  };

  const handleOpenUrl = (url: string) => {
    if (!url) {
      return;
    }

    const targetUrl = url.startsWith("http") ? url : `https://${url}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Manage your Supamocka projects.
          </p>
        </div>
        <Button type="button" onClick={() => onCreateProject()}>
          <Plus className="mr-2 h-4 w-4" />
          New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;

            return (
              <section
                key={project.id}
                className={`space-y-4 rounded-lg border bg-card p-6 shadow-sm transition-shadow ${
                  isActive ? "border-primary shadow-md" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {project.name || "Unnamed project"}
                    </h3>
                    <p className="text-sm text-muted-foreground break-all">
                      {project.url || "No API URL provided"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isActive ? (
                      <span className="text-xs font-medium uppercase text-primary">
                        Active
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSelectProject(project.id)}
                    >
                      Go to project
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete project</span>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`project-name-${project.id}`}>
                      Project name
                    </Label>
                    <Input
                      id={`project-name-${project.id}`}
                      value={project.name}
                      onChange={(event) =>
                        onUpdateProject(project.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder="Project name"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`project-url-${project.id}`}>API URL</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        id={`project-url-${project.id}`}
                        value={project.url}
                        onChange={(event) =>
                          onUpdateProject(project.id, {
                            url: event.target.value,
                          })
                        }
                        placeholder="https://project.supabase.co"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleOpenUrl(project.url)}
                        disabled={!project.url}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Open project URL</span>
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`project-key-${project.id}`}>
                      Service role key
                    </Label>
                    <Input
                      id={`project-key-${project.id}`}
                      value={project.publicKey}
                      onChange={(event) =>
                        onUpdateProject(project.id, {
                          publicKey: event.target.value,
                        })
                      }
                      placeholder="Service role key"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Project ID: <span className="font-mono">{project.id}</span>
                    </p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
