"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, Bookmark, Compass, Flame, Heart, Home, ImagePlus, LogIn, LogOut,
  MessageCircle, MessageSquare, MoreHorizontal, Music2, Plus, Search, Send,
  Settings, ShieldCheck, Sparkles, ThumbsUp, Upload, UserRound, Users, X, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Comment, Profile, VideoPost } from "@/lib/types";

const demoPosts: VideoPost[] = [
  { id: "demo-1", user_id: "creator-1", caption: "Lagos after the rain hits different 🌃 What city should we feature next?", video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=85", created_at: new Date().toISOString(), profiles: { id: "creator-1", username: "cityframes", display_name: "City Frames", avatar_url: null, bio: "Stories from the streets" }, likes_count: 12800, comments_count: 342 },
  { id: "demo-2", user_id: "creator-2", caption: "POV: you said one more episode at 2AM 😭", video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=85", created_at: new Date().toISOString(), profiles: { id: "creator-2", username: "filmclub", display_name: "Film Club", avatar_url: null, bio: "Movies, memes and more" }, likes_count: 8600, comments_count: 187 },
  { id: "demo-3", user_id: "creator-3", caption: "Small steps. Big energy. Show us what you're creating ⚡", video_url: "", thumbnail_url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=85", created_at: new Date().toISOString(), profiles: { id: "creator-3", username: "makewaves", display_name: "Make Waves", avatar_url: null, bio: "Create something today" }, likes_count: 4200, comments_count: 96 }
];

type Tab = "For You" | "Following" | "Explore" | "Inbox" | "Profile";

export default function AdujiApp() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<VideoPost[]>(demoPosts);
  const [tab, setTab] = useState<Tab>("For You");
  const [activePost, setActivePost] = useState<VideoPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState("");
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<string[]>([]);
  const [showGif, setShowGif] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [dmRecipient, setDmRecipient] = useState("");
  const [dmText, setDmText] = useState("");
  const [dmMessages, setDmMessages] = useState<{ id: string; body: string; mine: boolean }[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      if (data.user) loadProfile(data.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? { id: session.user.id, email: session.user.email } : null;
      setUser(nextUser);
      if (nextUser) setTimeout(() => loadProfile(nextUser.id), 0);
      else setProfile(null);
    });
    loadPosts();
    return () => { mounted = false; listener.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadProfile(userId: string) {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) setProfile(data as Profile);
  }

  async function loadPosts() {
    if (!supabase) return;
    const { data, error } = await supabase.from("videos")
      .select("id,user_id,caption,video_url,thumbnail_url,created_at,profiles(id,username,display_name,avatar_url,bio)")
      .eq("visibility", "public").order("created_at", { ascending: false }).limit(30);
    if (!error && data?.length) {
      const mapped = data as unknown as VideoPost[];
      setPosts(mapped);
    }
  }

  async function signIn() {
    if (!supabase) { setAuthMessage("Add your Supabase URL and anon/publishable key to .env.local first."); return; }
    setBusy(true); setAuthMessage("");
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setAuthMessage(result.error.message);
    else setAuthMessage(authMode === "signup" ? "Check your email to confirm your account, then sign in." : "Signed in.");
  }

  async function signInGoogle() {
    if (!supabase) { setAuthMessage("Configure Supabase in .env.local first."); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) setAuthMessage(error.message);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setProfile(null); setToast("Signed out");
  }

  async function toggleLike(post: VideoPost) {
    if (!user || !supabase) { setAuthOpen(true); setAuthMessage("Sign in to like videos."); return; }
    const { data: existing } = await supabase.from("video_likes").select("video_id").eq("video_id", post.id).eq("user_id", user.id).maybeSingle();
    if (existing) await supabase.from("video_likes").delete().eq("video_id", post.id).eq("user_id", user.id);
    else await supabase.from("video_likes").insert({ video_id: post.id, user_id: user.id });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked_by_me: !existing, likes_count: Math.max(0, (p.likes_count || 0) + (existing ? -1 : 1)) } : p));
    await supabase.from("engagement_events").insert({ user_id: user.id, video_id: post.id, event_type: existing ? "unlike" : "like" });
  }

  async function openComments(post: VideoPost) {
    setActivePost(post); setShowGif(false); setGifUrl("");
    if (!supabase || post.id.startsWith("demo-")) { setComments([]); return; }
    const { data } = await supabase.from("comments")
      .select("id,video_id,user_id,body,image_url,gif_url,created_at,profiles(id,username,display_name,avatar_url,bio)")
      .eq("video_id", post.id).order("created_at", { ascending: true }).limit(100);
    setComments((data || []) as unknown as Comment[]);
  }

  async function sendComment() {
    if (!activePost) return;
    if (!user || !supabase) { setAuthOpen(true); setAuthMessage("Sign in to comment."); return; }
    if (!commentText.trim() && !commentImage && !gifUrl) return;
    setBusy(true);
    let imageUrl: string | null = null;
    if (commentImage) {
      const path = `${user.id}/${crypto.randomUUID()}-${commentImage.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("comment-media").upload(path, commentImage, { upsert: false });
      if (uploadError) { setBusy(false); setToast(uploadError.message); return; }
      imageUrl = supabase.storage.from("comment-media").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase.from("comments").insert({
      video_id: activePost.id, user_id: user.id, body: commentText.trim(), image_url: imageUrl, gif_url: gifUrl || null
    }).select("id,video_id,user_id,body,image_url,gif_url,created_at,profiles(id,username,display_name,avatar_url,bio)").single();
    setBusy(false);
    if (error) { setToast(error.message); return; }
    setComments(prev => [...prev, data as unknown as Comment]);
    setCommentText(""); setCommentImage(null); setGifUrl("");
    await supabase.from("engagement_events").insert({ user_id: user.id, video_id: activePost.id, event_type: "comment" });
  }

  async function uploadVideo() {
    if (!user || !supabase) { setAuthOpen(true); setAuthMessage("Sign in before uploading."); return; }
    if (!uploadFile) { setToast("Choose a video file first."); return; }
    const maxMb = Number(process.env.NEXT_PUBLIC_VIDEO_UPLOAD_MAX_MB || 50);
    if (uploadFile.size > maxMb * 1024 * 1024) { setToast(`Video is larger than ${maxMb} MB. Use a smaller test file.`); return; }
    if (!uploadFile.type.startsWith("video/")) { setToast("Choose a valid video file."); return; }
    setBusy(true);
    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("videos").upload(path, uploadFile, { upsert: false, contentType: uploadFile.type });
    if (uploadError) { setBusy(false); setToast(uploadError.message); return; }
    const videoUrl = supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("videos").insert({
      user_id: user.id, caption: caption.trim(), video_url: videoUrl, visibility: "public"
    });
    setBusy(false);
    if (error) { setToast(error.message); return; }
    setShowUpload(false); setUploadFile(null); setCaption(""); setToast("Video posted"); await loadPosts();
  }

  async function findGifs() {
    const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    if (!key) { setToast("Add a GIPHY API key in .env.local to enable GIF search. You can still post GIF URLs."); return; }
    const q = encodeURIComponent(gifSearch || "trending");
    try {
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${q}&limit=12&rating=pg-13`);
      const json = await response.json();
      setGifResults((json.data || []).map((g: { images?: { fixed_height?: { url?: string } } }) => g.images?.fixed_height?.url).filter(Boolean));
    } catch { setToast("GIF search failed. Try again."); }
  }

  async function sendDm() {
    if (!user || !supabase) { setAuthOpen(true); setAuthMessage("Sign in to message people."); return; }
    if (!dmRecipient.trim() || !dmText.trim()) return;
    const { data: recipient } = await supabase.from("profiles").select("id").eq("username", dmRecipient.replace(/^@/, "")).maybeSingle();
    if (!recipient) { setToast("Couldn't find that username."); return; }
    const { error } = await supabase.from("messages").insert({ sender_id: user.id, recipient_id: recipient.id, body: dmText.trim() });
    if (error) { setToast(error.message); return; }
    setDmMessages(prev => [...prev, { id: crypto.randomUUID(), body: dmText.trim(), mine: true }]);
    setDmText(""); setToast("Message sent");
  }

  const filteredPosts = posts.filter(p => tab !== "Following" || p.user_id !== user?.id)
    .filter(p => !search || `${p.caption} ${p.profiles?.username || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark"><Zap size={22} fill="currentColor"/></span><span>aduji<span className="brand-dot">.</span></span></a>
        <div className="sidebar-user">
          <div className="avatar">{profile?.username?.slice(0,1).toUpperCase() || <UserRound size={18}/>}</div>
          <div className="user-copy"><b>{profile?.display_name || profile?.username || "Welcome to Aduji"}</b><span>{user ? `@${profile?.username || user.email?.split("@")[0]}` : "Your next favorite place"}</span></div>
          <span className="online-dot"/>
        </div>
        <div className="nav-label">MENU</div>
        <nav className="side-nav">
          {([
            ["For You", Home], ["Following", Users], ["Explore", Compass], ["Inbox", MessageCircle], ["Profile", UserRound]
          ] as const).map(([label, Icon]) => (
            <button key={label} className={`nav-item ${tab === label ? "selected" : ""}`} onClick={() => setTab(label)}>
              <Icon size={19}/><span>{label}</span>{label === "Inbox" && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={18}/></div><b>Your next big moment starts here.</b><p>Share your world. Find your people.</p><button onClick={() => setShowUpload(true)}><Plus size={16}/> Create a post</button></div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setToast("Settings panel is planned for the next implementation pass.")}><Settings size={18}/> Settings</button>
          {user ? <button className="nav-item" onClick={signOut}><LogOut size={18}/> Sign out</button> : <button className="nav-item" onClick={() => setAuthOpen(true)}><LogIn size={18}/> Sign in</button>}
          <span className="copyright">© 2026 ADUJI SOCIAL</span>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="mobile-brand brand"><span className="brand-mark"><Zap size={18} fill="currentColor"/></span> aduji<span className="brand-dot">.</span></div>
          <div className="searchbox"><Search size={18}/><input placeholder="Search creators, videos, sounds..." value={search} onChange={e => setSearch(e.target.value)}/><kbd>⌘ K</kbd></div>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications" onClick={() => setToast("Notifications will appear here when enabled.")}><Bell size={19}/></button>{user ? <button className="small-avatar" onClick={() => setTab("Profile")}>{profile?.username?.slice(0,1).toUpperCase() || "U"}</button> : <button className="signin-button" onClick={() => setAuthOpen(true)}>Sign in</button>}</div>
        </header>

        <div className="feed-header"><div><span className="eyebrow"><span className="live-pulse"/> YOUR DAILY DOSE OF CULTURE</span><h1>{tab === "For You" ? <>Your world.<br/><span>Your feed.</span></> : tab === "Following" ? <>Your people.<br/><span>Your feed.</span></> : tab === "Explore" ? <>Find your next<br/><span>obsession.</span></> : tab === "Inbox" ? <>Your people.<br/><span>Your inbox.</span></> : <>Your profile.<br/><span>Your story.</span></>}</h1><p className="subhead">The internet moves fast. Make your moment count.</p></div><button className="create-button" onClick={() => user ? setShowUpload(true) : setAuthOpen(true)}><Plus size={18}/> Create</button></div>

        {tab === "Inbox" ? (
          <section className="panel inbox-panel"><div className="panel-heading"><div><h2>Messages</h2><p>Keep the conversation going.</p></div><MessageSquare size={22}/></div><div className="dm-form"><label>Message a creator by username</label><input placeholder="@username" value={dmRecipient} onChange={e => setDmRecipient(e.target.value)}/><textarea placeholder="Write a message..." value={dmText} onChange={e => setDmText(e.target.value)} rows={3}/><button className="primary-button" onClick={sendDm}><Send size={16}/> Send message</button><p className="muted-note">This starter supports sending text messages by username. Conversation history, group chats, realtime subscriptions, and media messages need the next pass.</p></div><div className="dm-local-list">{dmMessages.map(m => <div className="dm-bubble mine" key={m.id}>{m.body}</div>)}</div></section>
        ) : tab === "Profile" ? (
          <section className="panel profile-panel"><div className="profile-hero"><div className="profile-big-avatar">{profile?.username?.slice(0,1).toUpperCase() || "A"}</div><div><h2>{profile?.display_name || "Your ADUJI profile"}</h2><p>@{profile?.username || "choose-a-username"}</p><span>{profile?.bio || "Your bio will show here."}</span></div></div><div className="profile-stats"><div><b>{posts.filter(p => p.user_id === user?.id).length}</b><span>Posts loaded</span></div><div><b>—</b><span>Followers</span></div><div><b>—</b><span>Following</span></div></div><button className="primary-button" onClick={() => user ? setToast("Profile editor is the next build step.") : setAuthOpen(true)}>Edit profile</button></section>
        ) : (
          <>
            <div className="feed-tabs"><button className={tab === "For You" ? "active" : ""} onClick={() => setTab("For You")}><Sparkles size={15}/> For You</button><button className={tab === "Following" ? "active" : ""} onClick={() => setTab("Following")}><Users size={15}/> Following</button><button className={tab === "Explore" ? "active" : ""} onClick={() => setTab("Explore")}><Flame size={15}/> Trending</button><span className="feed-tabs-spacer"/><span className="fresh-label"><span/> LIVE FEED</span></div>
            <div className="video-grid">
              {filteredPosts.map((post, index) => (
                <article className="video-card" key={post.id}>
                  <div className="video-cover" style={{ backgroundImage: post.thumbnail_url ? `linear-gradient(180deg, transparent 35%, rgba(6,8,12,.92) 100%), url("${post.thumbnail_url}")` : undefined }}>
                    {post.video_url ? <video src={post.video_url} controls playsInline preload="metadata" /> : <div className="demo-overlay"><span className="demo-pill">{post.id.startsWith("demo-") ? "COMMUNITY PICK" : "NEW POST"}</span><div className="cover-play"><span>▶</span></div><span className="demo-caption">Preview card · upload a video to play real content</span></div>}
                    <button className="more-button" aria-label="More options" onClick={() => setToast("Post actions menu is coming soon.")}><MoreHorizontal size={20}/></button>
                    <div className="video-meta"><div className="creator-row"><div className="creator-avatar">{post.profiles?.username?.slice(0,1).toUpperCase() || "A"}</div><div><b>{post.profiles?.display_name || post.profiles?.username || "ADUJI creator"}</b><span>@{post.profiles?.username || "creator"}</span></div><button className="follow-button" onClick={() => setToast(user ? "Follow relationships are the next build step." : "Sign in to follow creators.")}>Follow +</button></div><p>{post.caption}</p><div className="sound-line"><Music2 size={13}/> Original audio · ADUJI</div></div>
                  </div>
                  <div className="video-actions"><button onClick={() => toggleLike(post)} className={post.liked_by_me ? "liked" : ""}><Heart size={18} fill={post.liked_by_me ? "currentColor" : "none"}/><span>{formatCount(post.likes_count || 0)}</span></button><button onClick={() => openComments(post)}><MessageCircle size={18}/><span>{formatCount(post.comments_count || 0)}</span></button><button onClick={() => setToast("Copy-link sharing will be enabled in the next pass.")}><Send size={17}/><span>Share</span></button><button className="save-action" onClick={() => setToast("Save to collections is coming soon.")}><Bookmark size={17}/></button></div>
                </article>
              ))}
            </div>
            {!supabase && <div className="setup-banner"><ShieldCheck size={20}/><div><b>Connect your Supabase project</b><p>You're viewing the polished demo feed. Add your project keys and run the SQL migration to enable real accounts, uploads, and comments.</p></div></div>}
            {supabase && posts.length === 0 && <div className="empty-state"><Sparkles size={28}/><h3>Your feed is waiting</h3><p>Be the first to share something. Upload your first video to get started.</p><button className="primary-button" onClick={() => setShowUpload(true)}>Upload a video</button></div>}
          </>
        )}
      </section>

      <aside className="right-column">
        <div className="right-top"><span className="status-pill"><span/> ALL SYSTEMS READY</span><button className="icon-button" onClick={() => setToast("Settings are coming soon.")}><MoreHorizontal size={20}/></button></div>
        <section className="side-card welcome-card"><div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="welcome-bolt"><Zap size={30} fill="currentColor"/></div><span className="spark spark-one">✦</span><span className="spark spark-two">✧</span></div><span className="eyebrow">WELCOME TO ADUJI</span><h2>Don't just scroll.<br/><span>Make a wave.</span></h2><p>A new space for the things you love and the people who get it.</p><button className="primary-button full" onClick={() => user ? setShowUpload(true) : setAuthOpen(true)}>{user ? "Share your first post" : "Join the community"} <span>↗</span></button><div className="welcome-foot"><ShieldCheck size={14}/> Your community. Your rules.</div></section>
        <section className="side-card trends-card"><div className="section-title"><div><span className="eyebrow">WHAT'S MOVING</span><h3>Trending now <Flame size={17} className="flame-icon"/></h3></div><button onClick={() => setTab("Explore")}>See all</button></div>{[["01","#LagosAfterDark","2.4M posts","hot"],["02","#FitCheck","892K posts",""],["03","#AnimeTok","741K posts",""],["04","#SoftLifeSeason","518K posts",""]].map(t => <button className="trend-row" key={t[1]} onClick={() => {setSearch(t[1]);setTab("Explore")}}><span className="trend-rank">{t[0]}</span><span className="trend-copy"><b>{t[1]}</b><span>{t[2]}</span></span>{t[3] && <Flame size={15} className="flame-icon"/>}</button>)}</section>
        <section className="side-card creators-card"><div className="section-title"><div><span className="eyebrow">YOUR NEXT FOLLOW</span><h3>Creators to know</h3></div><button onClick={() => setTab("Explore")}>More</button></div>{demoPosts.map(p => <div className="suggested-user" key={p.id}><div className="creator-avatar large">{p.profiles?.username?.slice(0,1).toUpperCase()}</div><div className="suggested-copy"><b>{p.profiles?.display_name}</b><span>@{p.profiles?.username}</span></div><button aria-label={`Follow ${p.profiles?.username}`} onClick={() => setToast(user ? "Follow feature is coming next." : "Sign in to follow creators.")}><Plus size={16}/></button></div>)}</section>
        <footer className="right-footer"><div><a href="#">About</a><a href="#">Guidelines</a><a href="#">Privacy</a><a href="#">Terms</a></div><span>MADE FOR WHAT'S NEXT. <span>✦</span></span></footer>
      </aside>

      {activePost && <div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setActivePost(null)}}><section className="comments-modal"><header><div><span className="eyebrow">JOIN THE CONVERSATION</span><h2>Comments <span>{comments.length}</span></h2></div><button className="icon-button" onClick={() => setActivePost(null)}><X size={20}/></button></header><div className="comment-post-caption"><b>@{activePost.profiles?.username}</b> {activePost.caption}</div><div className="comments-list">{comments.length === 0 ? <div className="comments-empty"><MessageCircle size={27}/><b>It's quiet in here.</b><span>Be the first to say something.</span></div> : comments.map(c => <div className="comment-row" key={c.id}><div className="creator-avatar">{c.profiles?.username?.slice(0,1).toUpperCase() || "U"}</div><div className="comment-body"><b>@{c.profiles?.username || "community member"}</b><p>{c.body}</p>{c.image_url && <img className="comment-media" src={c.image_url} alt="Comment attachment"/>}{c.gif_url && <img className="comment-media gif-media" src={c.gif_url} alt="GIF reply"/>}<span>{new Date(c.created_at).toLocaleString()}</span></div></div>)}</div><div className="comment-composer"><div className="composer-attachments">{commentImage && <span className="attachment-chip">{commentImage.name}<button onClick={() => setCommentImage(null)}><X size={12}/></button></span>}{gifUrl && <span className="attachment-chip">GIF selected <button onClick={() => setGifUrl("")}><X size={12}/></button></span>}</div><textarea placeholder="Add something to the conversation..." value={commentText} onChange={e => setCommentText(e.target.value)} rows={2}/><div className="composer-bottom"><div><button title="Attach image" onClick={() => imageInput.current?.click()}><ImagePlus size={18}/></button><input ref={imageInput} type="file" accept="image/*" hidden onChange={e => setCommentImage(e.target.files?.[0] || null)}/><button title="Add GIF" onClick={() => setShowGif(v => !v)}><span className="gif-label">GIF</span></button></div><button className="primary-button" disabled={busy} onClick={sendComment}><Send size={15}/> Reply</button></div>{showGif && <div className="gif-picker"><div className="gif-search"><input placeholder="Search GIFs..." value={gifSearch} onChange={e => setGifSearch(e.target.value)}/><button onClick={findGifs}><Search size={16}/></button></div>{gifResults.length ? <div className="gif-grid">{gifResults.map(url => <button key={url} onClick={() => {setGifUrl(url);setShowGif(false)}}><img src={url} alt="GIF result"/></button>)}</div> : <p>{process.env.NEXT_PUBLIC_GIPHY_API_KEY ? "Search for a GIF above." : "Add NEXT_PUBLIC_GIPHY_API_KEY to enable GIF search."}</p>}</div>}</div></section></div>}

      {showUpload && <div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setShowUpload(false)}}><section className="dialog-modal"><header><div><span className="eyebrow">YOUR MOMENT, YOUR STAGE</span><h2>Create a post</h2></div><button className="icon-button" onClick={() => setShowUpload(false)}><X size={20}/></button></header><button className="upload-dropzone" onClick={() => uploadInput.current?.click()}><Upload size={28}/><b>{uploadFile?.name || "Choose a video to upload"}</b><span>MP4, WebM or other supported video · up to {process.env.NEXT_PUBLIC_VIDEO_UPLOAD_MAX_MB || 50} MB</span><input ref={uploadInput} type="file" accept="video/*" hidden onChange={e => setUploadFile(e.target.files?.[0] || null)}/></button><label className="field-label">Caption</label><textarea className="dialog-textarea" placeholder="Give your video a little context..." value={caption} onChange={e => setCaption(e.target.value)} rows={3}/><button className="primary-button full" disabled={busy || !uploadFile} onClick={uploadVideo}>{busy ? "Uploading..." : <><Upload size={16}/> Publish video</>}</button><p className="muted-note">Test uploads use Supabase Storage. For production, connect a video service for transcoding and adaptive streaming.</p></section></div>}

      {authOpen && <div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setAuthOpen(false)}}><section className="dialog-modal auth-modal"><header><div><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>{authMode === "login" ? "Welcome back." : "Join ADUJI."}</h2><p>{authMode === "login" ? "Pick up where your feed left off." : "Make an account. Find your people."}</p></div><button className="icon-button" onClick={() => setAuthOpen(false)}><X size={20}/></button></header><button className="google-button" onClick={signInGoogle}><span className="google-g">G</span> Continue with Google</button><div className="auth-divider"><span/> OR WITH EMAIL <span/></div><label className="field-label">Email address</label><input className="dialog-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/><label className="field-label">Password</label><input className="dialog-input" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/><button className="primary-button full auth-submit" disabled={busy || !email || password.length < 8} onClick={signIn}>{busy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}</button>{authMessage && <p className="auth-message">{authMessage}</p>}<p className="auth-switch">{authMode === "login" ? "New to ADUJI?" : "Already have an account?"} <button onClick={() => {setAuthMode(authMode === "login" ? "signup" : "login");setAuthMessage("")}}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p><p className="muted-note">Google sign-in requires enabling the Google provider in Supabase Auth settings.</p></section></div>}

      {toast && <div className="toast"><span className="toast-dot"/>{toast}<button onClick={() => setToast("")}><X size={14}/></button></div>}
    </main>
  );
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(0)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}