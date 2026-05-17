import { Button } from "@ioca/react";
import { usePageContext } from "vike-react/usePageContext";
import css from "./index.module.css";

export default function Page() {
    const { is404 } = usePageContext();

    if (is404) {
        return (
            <div className={css.page}>
                <h1>
                    <span>404</span> Not Found
                </h1>

                <Button href="/" size="large" className={css.back}>
                    BACK
                </Button>
            </div>
        );
    }

    return (
        <div className={css.page}>
            <h1>
                <span>500</span> Internal Error
            </h1>

            <Button href="/" size="large" className={css.back}>
                BACK
            </Button>
        </div>
    );
}
