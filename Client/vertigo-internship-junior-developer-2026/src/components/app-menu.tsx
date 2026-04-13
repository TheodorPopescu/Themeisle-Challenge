import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation menu">
                    <Menu />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 min-w-48">
                <DropdownMenuLabel>Navigate</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link to="/">Markets</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/about">About</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/leaderboard">Leaderboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/profile">My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link to="/auth/logout">Logout</Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}