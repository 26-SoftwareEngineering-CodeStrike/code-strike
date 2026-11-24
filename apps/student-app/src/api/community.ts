import type {
  ApiTransport, CommunityCommentDto, CommunityPostDto, CommunityPostInput,
  CompetitionSubmissionDto, CompetitionSubmissionInput, PostInteractionKind, PostInteractionsDto, UserDto,
} from '@codestrike/contracts'
import { imageDataUrl } from './community-images'

export function ownsContent(user: UserDto | null, row: {username: string}): boolean {
  return user?.role === 'Student' && user.username === row.username
}

export function postPayload(text: string, linkText: string, previews: string[]): CommunityPostInput {
  const links = linkText.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  if (links.length > 20) throw new Error('Use up to 20 links.')
  if (links.some(link => !/^https?:\/\/[^\s/]+(?:[/?#]\S*)?$/i.test(link) || link.length > 2048)) {
    throw new Error('Enter a full HTTP or HTTPS link on each line.')
  }
  if (!text.trim() && !links.length && !previews.length) throw new Error('Add text, a link or an image.')
  return { text: text.trim(), links, images: previews.map(url => ({dataBase64: url.slice(url.indexOf(',') + 1)})) }
}

export function createCommunityApi(transport: ApiTransport) {
  const id = encodeURIComponent
  const required = { auth: 'required' } as const

  async function list<T>(path: string, privateList = false): Promise<T[]> {
    const limit = 100
    const rows: T[] = []
    for (let offset = 0; ; offset += limit) {
      const page = await transport.request<T[]>({
        path, auth: privateList ? 'required' : 'optional', query: { offset, limit },
      })
      rows.push(...page)
      if (page.length < limit) return rows
    }
  }

  const myPosts = () => list<CommunityPostDto>('/me/posts', true)

  return {
    async feed(competitionId: string, signedIn: boolean) {
      const [published, mine] = await Promise.all([
        list<CommunityPostDto>(`/competitions/${id(competitionId)}/posts`),
        signedIn ? myPosts() : [],
      ])
      const visible = new Set(published.map(post => post.revisionId))
      const personal = mine.filter(post => post.competitionId === competitionId && !visible.has(post.revisionId))
      return { published, personal }
    },
    async thread(postId: string, ownVersion: boolean, signedIn: boolean) {
      const path = `/posts/${id(postId)}`
      const post = ownVersion
        ? (signedIn ? (await myPosts()).find(row => row.id === postId) : null)
        : await transport.request<CommunityPostDto>({ path })
      if (!post) throw new Error('This version is unavailable for the current account.')
      if (post.status !== 'Approved') return { post, comments: [], interactions: null }
      const [comments, interactions] = await Promise.all([
        list<CommunityCommentDto>(path + '/comments'),
        signedIn ? transport.request<PostInteractionsDto>({path: path + '/interactions', ...required}) : null,
      ])
      return { post, comments, interactions }
    },
    async latestPost(postId: string) {
      const post = (await myPosts()).find(row => row.id === postId)
      if (!post) throw new Error('Only the author can edit this post.')
      return post
    },
    createPost: (competitionId: string, body: CommunityPostInput) =>
      transport.request<CommunityPostDto>({path: `/competitions/${id(competitionId)}/posts`, method: 'POST', body, ...required}),
    editPost: (postId: string, body: CommunityPostInput) =>
      transport.request<CommunityPostDto>({path: `/posts/${id(postId)}`, method: 'PATCH', body, ...required}),
    deletePost: (postId: string) =>
      transport.request<void>({path: `/posts/${id(postId)}`, method: 'DELETE', ...required}),
    comment: (postId: string, text: string, parentId: string | null) =>
      transport.request<CommunityCommentDto>({path: `/posts/${id(postId)}/comments`, method: 'POST', body: {text, parentId}, ...required}),
    editComment: (commentId: string, text: string) =>
      transport.request<CommunityCommentDto>({path: `/comments/${id(commentId)}`, method: 'PATCH', body: {text}, ...required}),
    deleteComment: (commentId: string) =>
      transport.request<void>({path: `/comments/${id(commentId)}`, method: 'DELETE', ...required}),
    interact: (postId: string, kind: PostInteractionKind, enabled: boolean) =>
      transport.request<{kind: PostInteractionKind; active: boolean}>({
        path: `/posts/${id(postId)}/interactions/${kind}`, method: enabled ? 'PUT' : 'DELETE', ...required,
      }),
    async image(imageId: string) {
      const bytes = await transport.request<ArrayBuffer>({
        path: `/images/${id(imageId)}`, headers: { Accept: 'image/png, image/jpeg' },
      })
      return imageDataUrl(bytes)
    },
    submissions: () => list<CompetitionSubmissionDto>('/competition-submissions/me', true),
    saveSubmission: (body: CompetitionSubmissionInput, submissionId?: string) =>
      transport.request<CompetitionSubmissionDto>({
        path: submissionId ? `/competition-submissions/${id(submissionId)}` : '/competition-submissions',
        method: submissionId ? 'PATCH' : 'POST', body, ...required,
      }),
    withdrawSubmission: (submissionId: string) =>
      transport.request<void>({path: `/competition-submissions/${id(submissionId)}`, method: 'DELETE', ...required}),
  }
}

export type CommunityApi = ReturnType<typeof createCommunityApi>
