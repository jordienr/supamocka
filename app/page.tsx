"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useLocalStorage } from "@uidotdev/usehooks";
import { createClient, User } from "@supabase/supabase-js";
import { useEffect, useState, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faker } from "@faker-js/faker";
import { Toaster, toast } from "sonner";

export default function Home() {
  const [accordions, setAccordions] = useLocalStorage("accordions", [
    "settings",
  ]);
  const [settings, setSettings] = useLocalStorage("api", {
    url: "",
    publicKey: "",
    secretKey: "",
  });
  const [email, setEmail] = useState("");

  const adminClient = useMemo(() => {
    return createClient(settings.url, settings.secretKey);
  }, [settings.url, settings.secretKey]);

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
        const res = await fetch(settings.url + "/rest/v1" + pollingEndpoint);
        toast.info("GET: " + pollingEndpoint + " " + res.status);
      }, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [isPolling, pollingInterval, pollingEndpoint, settings.url]);

  const [users, setUsers] = useLocalStorage<User[]>("users", []);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await adminClient.auth.admin
        .listUsers()
        .then((res) => res.data);
      setUsers(res.users);
    };
    fetchUsers();
  }, [adminClient, setUsers]);

  return (
    <div className="font-[family-name:var(--font-geist-sans)] p-4 max-w-xl mx-auto">
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
              <div className="mt-2">
                <Label>API URL</Label>
                <Input
                  value={settings.url}
                  onChange={(e) =>
                    setSettings({ ...settings, url: e.target.value })
                  }
                />
                <Label>Public Key</Label>
                <Input
                  value={settings.publicKey}
                  onChange={(e) =>
                    setSettings({ ...settings, publicKey: e.target.value })
                  }
                />
                <Label>Service Key</Label>
                <Input
                  type="password"
                  value={settings.secretKey}
                  onChange={(e) =>
                    setSettings({ ...settings, secretKey: e.target.value })
                  }
                />
                <div className="flex justify-end gap-4 items-center mt-4">
                  <Link
                    target="_blank"
                    href="https://supabase.com/dashboard/project/_/settings/api"
                  >
                    Get API vars
                  </Link>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="create-user">
            <AccordionTrigger>Create user</AccordionTrigger>
            <AccordionContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const request = adminClient.auth.admin
                    .createUser({
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
                    <span className="text-zinc-500 select-none">Password</span>
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
                  onChange={(e) => setPollingInterval(Number(e.target.value))}
                />
                <Label>Endpoint</Label>
                <Input
                  value={pollingEndpoint}
                  onChange={(e) => setPollingEndpoint(e.target.value)}
                />
                <div className="actions">
                  <Link
                    target="_blank"
                    href="https://supabase.com/dashboard/project/_/api"
                  >
                    View Endpoints
                  </Link>
                  <Button onClick={() => setIsPolling(!isPolling)}>
                    {isPolling ? "Stop" : "Start"}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
