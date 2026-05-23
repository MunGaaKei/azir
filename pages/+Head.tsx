// https://vike.dev/Head

import "@ioca/react/index.css";
import "streamdown/styles.css";
import ico from "/ico.ico";

export function Head() {
    return (
        <>
            <link rel="icon" href={ico} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
                rel="stylesheet"
            />
        </>
    );
}
