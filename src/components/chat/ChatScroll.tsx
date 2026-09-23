import CustomScroll from '../scroll/CustomScroll';

function ChatScroll({ children }: { children: React.ReactNode }) {
    return (
        <CustomScroll
            hostClassName="chatScroll-host"
            viewportClassName="chatContainer chatScroll-viewport"
            bottomReserveSelector=".messageContainer"
        >
            {children}
        </CustomScroll>
    );
}

export default ChatScroll;
