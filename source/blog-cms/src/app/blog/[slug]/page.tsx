import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { compileMDX } from 'next-mdx-remote/rsc'
import { getPostBySlug, getAllPosts } from '@/lib/blog'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) return { title: 'Post Not Found' }

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.image ? [{ url: post.image }] : [],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) notFound()

  const { content } = await compileMDX({
    source: post.content,
    options: { parseFrontmatter: false },
  })

  return (
    <main className="bg-white">
      {/* Header */}
      <header className="pt-36 pb-10 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-gray-500 mb-10 uppercase tracking-widest">
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-gray-900 truncate max-w-[200px]">{post.title}</span>
          </nav>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-6">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs uppercase tracking-widest text-gray-500">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-light text-gray-900 leading-[0.95] mb-8">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{post.author}</span>
            <span>&middot;</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </time>
            <span>&middot;</span>
            <span>{post.readingTime}</span>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      {post.image && (
        <div className="w-full">
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="100vw"
              quality={95}
            />
          </div>
        </div>
      )}

      {/* Article Body */}
      <article className="pt-16 pb-12 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="prose prose-lg max-w-none">
            {content}
          </div>
        </div>
      </article>

      {/* Back link */}
      <div className="bg-white pb-12">
        <div className="max-w-3xl mx-auto px-6 border-t border-gray-200 pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm uppercase tracking-widest text-gray-500 hover:gap-4 transition-all duration-300"
          >
            <span className="text-lg leading-none">&larr;</span>
            All Posts
          </Link>
        </div>
      </div>
    </main>
  )
}
