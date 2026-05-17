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

                <a href="/" className={`${css.back} nav`}>
                    BACK
                </a>
            </div>
        );
    }

    return (
        <div className={css.page}>
            <h1>
                <span>500</span> Internal Error
            </h1>

            <a href="/" className={`${css.back} nav`}>
                BACK
            </a>
        </div>
    );
}
