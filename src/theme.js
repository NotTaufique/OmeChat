import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
    config: {
        initialColorMode: 'dark',
        useSystemColorMode: false,
    },
    colors: {
        dark: {
            900: '#000000',
            800: '#0a0a0a',
            700: '#1a1a1a',
            600: '#2a2a2a',
        }
    },
    styles: {
        global: (props) => ({
            body: {
                bg: props.colorMode === 'dark' ? 'dark.900' : 'gray.50',
                color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.800',
            },
        }),
    },
});

export default theme;
