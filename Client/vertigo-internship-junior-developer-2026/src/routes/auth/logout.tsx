import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

function LogoutPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    logout();
    navigate({ to: "/auth/login", replace: true });
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <div className="flex justify-end py-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl">Logging out</CardTitle>
              <CardDescription>Your session is being cleared.</CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Redirecting to login...
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/auth/logout")({
  component: LogoutPage,
});
