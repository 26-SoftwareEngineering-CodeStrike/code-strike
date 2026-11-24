export interface CommunityPostInput {
  text: string
  links: string[]
  images: { dataBase64: string }[]
}

export interface CommunityPostDto {
  id: string
  competitionId: string
  username: string
  revisionId: string
  status: string
  text: string
  links: string[]
  imageIds: string[]
  likes: number
  favorites: number
  createdAt: string
}

export interface CommunityCommentDto {
  id: string
  postId: string
  competitionId: string
  parentId: string | null
  username: string
  revisionId: string
  status: string
  text: string
  createdAt: string
}

export type PostInteractionKind = 'Like' | 'Favorite'

export interface PostInteractionsDto {
  liked: boolean
  favorited: boolean
}

export interface CompetitionSubmissionInput {
  title: string
  description: string
  category: string
  registrationDeadline: string
  eligibilityRules: string
  maxTeamSize: number
  officialSourceUrl: string
  coverImage: string | null
}

export interface CompetitionSubmissionDto {
  id: string
  competitionId: string | null
  revisionId: string
  status: string
  content: CompetitionSubmissionInput
  deleted: boolean
}
