import { Button } from "@ioca/react";
import { ModelDropdown } from "../model/modal";
import { BotAnimate } from "../ui/bot-animate";
import css from "./index.module.css";

export default function Header() {
    return (
        <header className={css.header}>
            <ModelDropdown />

            <Button square flat href="/agents">
                <BotAnimate />
            </Button>

            <a href="/" className="ml-auto flex">
                <img src="/logo.png" alt="logo" width={32} height={32} />
            </a>
        </header>
    );
}
