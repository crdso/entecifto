import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const META = {
  "/": {
    title: "ENTEC 2026 - Encontro de Tecnologia do IFTO",
    description: "ENTEC 2026 - Encontro de Tecnologia do IFTO. Futuro conectado: como a tecnologia está redesenhando o mundo.",
    canonical: "https://entecifto.online/",
    robots: "index,follow",
  },
  "/inscricao": {
    title: "Inscrição | ENTEC 2026",
    description: "Inscreva-se no ENTEC 2026, realizado nos dias 23 e 24 de setembro no IFTO — Campus Araguatins.",
    canonical: "https://entecifto.online/inscricao",
    robots: "index,follow",
  },
  "/sobre": {
    title: "Sobre | ENTEC 2026",
    description: "Conheça o ENTEC 2026 e a proposta do evento sobre tecnologia, inovação e futuro conectado.",
    canonical: "https://entecifto.online/sobre",
    robots: "index,follow",
  },
  "/privacidade": {
    title: "Política de Privacidade | ENTEC 2026",
    description: "Consulte a Política de Privacidade do site oficial do ENTEC 2026.",
    canonical: "https://entecifto.online/privacidade",
    robots: "index,follow",
  },
  "/admin": {
    title: "Administração | ENTEC 2026",
    description: "Painel administrativo do ENTEC 2026.",
    canonical: null,
    robots: "noindex,nofollow,noarchive",
  },
};

function ensureMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function ensureCanonical(href) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!href) {
    if (link) link.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const key = META[pathname] ? pathname : (pathname.startsWith("/admin") ? "/admin" : null);
    const data = key ? META[key] : {
      title: "Página não encontrada | ENTEC 2026",
      description: "A página que você tentou acessar não existe ou pode ter sido movida.",
      canonical: null,
      robots: "noindex,nofollow",
    };

    document.title = data.title;

    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", data.description);

    ensureMeta("robots", data.robots);
    ensureCanonical(data.canonical);
  }, [pathname]);

  return null;
}
