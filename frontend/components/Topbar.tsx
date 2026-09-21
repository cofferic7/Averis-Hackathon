export default function Topbar() {
    return (
        <header className="topbar">
            <div className="page-title"></div>

            <div className="user-area">
                <div className="avatar">OU</div>

                <div>
                    <strong>Operations User</strong>
                    <span>Reviewer</span>
                </div>

                <span className="down">⌄</span>
            </div>
        </header>
    );
}