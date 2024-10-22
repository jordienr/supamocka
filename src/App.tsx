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
    secretKey: "",
  });

  const [email, setEmail] = useState("");

  function adminClient() {
    return createClient(settings.url, settings.secretKey);
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
        const res = await fetch(settings?.url + "/rest/v1" + pollingEndpoint);
        toast.info("GET: " + pollingEndpoint + " " + res.status);
      }, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [isPolling, pollingInterval, pollingEndpoint, settings?.url]);

  const [users, setUsers] = useLocalStorage<User[]>("users", []);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await adminClient()
        .auth.admin.listUsers()
        .then((res) => res.data);
      setUsers(res?.users);
    };
    fetchUsers();
  }, [setUsers]);

  const hasSettings = settings.url && settings.secretKey && settings.publicKey;

  const [files, setFiles] = useState<string[]>([]);

  async function loadFiles(bucket: string) {
    const client = createClient(settings.url, settings.secretKey);
    const res = await client.storage.from(bucket).list();
    if (res.data) {
      setFiles(res.data.map((file) => file.name));
    }
  }

  return (
    <div className="font-mono p-4 max-w-xl mx-auto">
      <Toaster position="top-right" />
      <h1 className="p-3 font-medium text-lg text-center">supamocka</h1>

      <div className="">
        <Accordion
          className="p-3"
          type="multiple"
          value={accordions}
          onValueChange={setAccordions}
        >
          <AccordionItem value="settings">
            <AccordionTrigger>Settings</AccordionTrigger>
            <AccordionContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  const formData = new FormData(e.currentTarget);
                  const url = formData.get("url") as string;
                  const publicKey = formData.get("publicKey") as string;
                  const secretKey = formData.get("secretKey") as string;

                  if (typeof url !== "string") {
                    return;
                  }

                  setSettings({
                    url,
                    publicKey,
                    secretKey,
                  });
                }}
                className="mt-2"
              >
                <Label>API URL</Label>
                <Input name="url" defaultValue={settings?.url} />
                <Label>Public Key</Label>
                <Input name="publicKey" defaultValue={settings.publicKey} />
                <Label>Service Key</Label>
                <Input
                  type="password"
                  name="secretKey"
                  defaultValue={settings.secretKey}
                />
                <div className="flex justify-end gap-4 items-center mt-4">
                  <a
                    target="_blank"
                    href="https://supabase.com/dashboard/project/_/settings/api"
                  >
                    Get API vars
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
                      const request = adminClient()
                        .auth.admin.createUser({
                          email,
                          password: "TestPassword1",
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
                      <Button>Create</Button>
                    </div>
                  </form>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="users">
                <AccordionTrigger>Users</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    {users.map((user) => (
                      <div key={user.id}>{user.email}</div>
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

                      const client = createClient(
                        settings.url,
                        settings.secretKey
                      );
                      client.channel(channel).send({
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

                      const client = createClient(
                        settings.url,
                        settings.secretKey
                      );
                      const res = client.storage
                        .from(bucket)
                        .upload((fileName || file.name) + randomFileName, file);

                      toast.promise(res, {
                        loading: "Uploading...",
                        success: "Uploaded",
                        error: "Error uploading",
                      });
                    }}
                  >
                    <Label>Bucket</Label>
                    <Input name="bucket" defaultValue="test" />
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
                        className="p-2 border-b hover:bg-zinc-100"
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
    </div>
  );
}
